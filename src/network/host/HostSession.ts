import { MAX_PLAYERS } from "@/game/constants/RaceConstants";
import { GameEngine } from "@/game/engine/GameEngine";
import { findTrack } from "@/game/tracks";
import { sanitizeCarStyle, type CarStyle } from "@/rendering/carStyle";
import { CAR_COLORS } from "@/rendering/RenderConstants";
import { PROTOCOL_VERSION, ROOM_PORT, SNAPSHOT_INTERVAL_TICKS } from "@/network/constants";
import {
  encodeMessage,
  parseClientMessage,
  sanitizeName,
  type HostMessage,
  type LobbyInfo,
  type LobbyPlayer,
  type PlayerId,
  type RaceStartInfo,
} from "@/network/protocol";
import { roomCodeFromIp } from "@/network/roomCode";
import { LobbyStore, type MultiplayerSession } from "@/network/session";
import type { TcpServerFactory } from "@/network/transport/tcp";
import { WebSocketServer, type WebSocketConnection } from "@/network/transport/WebSocketServer";

import { InputQueue } from "./InputQueue";
import { buildSnapshot } from "./SnapshotBuilder";

export const HOST_PLAYER_ID: PlayerId = "host";

export interface HostOptions {
  name: string;
  colorIndex: number;
  style: CarStyle;
  trackId: string;
  laps: number;
  createTcpServer: TcpServerFactory;
  /** Addresses other phones can reach this one on, best first (see `selectHostAddresses`). */
  getLocalAddresses: () => string[];
  port?: number;
}

interface Peer {
  player: LobbyPlayer;
  connection: WebSocketConnection;
  inputs: InputQueue;
}

/**
 * The authoritative side. Runs the room lobby, then the one real `GameEngine`:
 * remote inputs are fed in before each tick, snapshots and race events go out after.
 */
export class HostSession implements MultiplayerSession {
  readonly role = "host" as const;
  private readonly server: WebSocketServer;
  private readonly lobby: LobbyStore;
  private readonly peers = new Map<PlayerId, Peer>();
  private nextPeerNumber = 1;
  private engine: GameEngine | null = null;
  private raceInfo: RaceStartInfo | null = null;
  private detachEngine: (() => void) | null = null;

  constructor(private readonly options: HostOptions) {
    this.server = new WebSocketServer(options.createTcpServer);
    this.lobby = new LobbyStore({
      status: "connecting",
      roomCode: null,
      hostAddresses: [],
      localPlayerId: HOST_PLAYER_ID,
      trackId: findTrack(options.trackId).id,
      laps: options.laps,
      players: [
        {
          id: HOST_PLAYER_ID,
          name: sanitizeName(options.name, "Host"),
          colorIndex: options.colorIndex % CAR_COLORS.length,
          style: sanitizeCarStyle(options.style),
          isHost: true,
          connected: true,
        },
      ],
      closeReason: null,
    });
  }

  readonly getLobby = () => this.lobby.get();
  readonly subscribe = (listener: () => void) => this.lobby.subscribe(listener);

  /** Starts listening; resolves once the room is joinable. */
  async open(): Promise<void> {
    await this.server.listen(this.options.port ?? ROOM_PORT, (connection) => this.handleConnection(connection));
    this.lobby.update({ status: "lobby" });
    this.refreshAddresses();
  }

  /**
   * Re-reads this phone's addresses, e.g. after the hotspot or Wi-Fi is switched on
   * while the lobby is open. Cheap; safe to poll.
   */
  refreshAddresses(): void {
    let addresses: string[];
    try {
      addresses = this.options.getLocalAddresses();
    } catch {
      addresses = [];
    }
    const current = this.lobby.get().hostAddresses;
    if (addresses.length === current.length && addresses.every((a, i) => a === current[i])) return;
    this.lobby.update({ hostAddresses: addresses, roomCode: addresses.length > 0 ? roomCodeFromIp(addresses[0]) : null });
  }

  /** The authoritative engine while racing; the host's own screen renders and drives it. */
  get raceEngine(): GameEngine | null {
    return this.engine;
  }

  get raceStartInfo(): RaceStartInfo | null {
    return this.raceInfo;
  }

  startRace(): GameEngine {
    if (this.engine) return this.engine;
    const { trackId, laps, players } = this.lobby.get();
    const racers = players.filter((p) => p.connected);
    const info: RaceStartInfo = {
      trackId,
      laps,
      players: racers.map(({ id, name, colorIndex, style }) => ({ id, name, colorIndex, style })),
    };
    const engine = new GameEngine({ track: findTrack(trackId), carIds: racers.map((p) => p.id), laps });

    const removeHooks = engine.addStepHooks({
      beforeStep: () => {
        for (const peer of this.peers.values()) {
          const input = peer.inputs.next();
          if (input) engine.setInput(peer.player.id, input);
        }
      },
      afterStep: (tick) => {
        if (tick % SNAPSHOT_INTERVAL_TICKS === 0) this.broadcast(buildSnapshot(engine.state, this.collectAcks()));
      },
    });
    const unsubscribe = engine.subscribe((event) => {
      // Impacts are cosmetic and frequent; clients detect their own locally.
      if (event.type !== "impact") this.broadcast({ type: "event", event, race: engine.state.race });
    });
    this.detachEngine = () => {
      removeHooks();
      unsubscribe();
    };

    this.engine = engine;
    this.raceInfo = info;
    this.broadcast({ type: "raceStart", race: info });
    this.lobby.update({ status: "racing" });
    this.broadcastLobby();
    return engine;
  }

  restartRace(): void {
    this.engine?.resetRace();
    this.engine?.startRace();
  }

  close(reason = "The host closed the room."): void {
    if (this.lobby.get().status === "closed") return;
    this.broadcast({ type: "roomClosed", reason });
    this.detachEngine?.();
    this.engine?.dispose();
    this.engine = null;
    this.server.close();
    this.peers.clear();
    this.lobby.update({ status: "closed", closeReason: reason });
  }

  // ---- Connections ----

  private handleConnection(connection: WebSocketConnection): void {
    let peer: Peer | null = null;

    connection.onMessage = (text) => {
      const message = parseClientMessage(text);
      if (!message) return;

      if (!peer) {
        if (message.type !== "hello") return;
        const rejection = this.rejectionReason(message.protocol);
        if (rejection) {
          send(connection, { type: "rejected", reason: rejection });
          connection.close();
          return;
        }
        peer = this.admit(connection, message.name, message.colorIndex, message.style);
        return;
      }

      if (message.type === "input") peer.inputs.push(message.inputs);
    };

    connection.addCloseListener(() => {
      if (peer) this.handleDisconnect(peer);
    });
  }

  private rejectionReason(protocol: number): string | null {
    const { status, players } = this.lobby.get();
    if (protocol !== PROTOCOL_VERSION) return "This room is running a different version of the game.";
    if (status !== "lobby") return "That race has already started.";
    if (players.length >= MAX_PLAYERS) return "That room is full.";
    return null;
  }

  private admit(connection: WebSocketConnection, name: string, requestedColor: number, style: CarStyle): Peer {
    const number = this.nextPeerNumber++;
    const player: LobbyPlayer = {
      id: `p${number}`,
      name: sanitizeName(name, `Player ${number + 1}`),
      colorIndex: this.freeColor(requestedColor),
      style,
      isHost: false,
      connected: true,
    };
    const peer: Peer = { player, connection, inputs: new InputQueue() };
    this.peers.set(player.id, peer);
    this.lobby.update({ players: [...this.lobby.get().players, player] });
    send(connection, { type: "welcome", playerId: player.id, lobby: this.lobbyInfo() });
    this.broadcastLobby();
    return peer;
  }

  private handleDisconnect(peer: Peer): void {
    if (this.lobby.get().status === "closed") return;
    this.peers.delete(peer.player.id);
    const players = this.lobby.get().players;
    if (this.engine) {
      // Mid-race: keep the car on track (it coasts on its last input) but mark the player gone.
      this.engine.setInput(peer.player.id, { throttle: 0, steering: 0, brake: false, boost: false });
      this.lobby.update({ players: players.map((p) => (p.id === peer.player.id ? { ...p, connected: false } : p)) });
    } else {
      this.lobby.update({ players: players.filter((p) => p.id !== peer.player.id) });
    }
    this.broadcastLobby();
  }

  /** Requested colour if free, otherwise the next free one. */
  private freeColor(requested: number): number {
    const taken = new Set(this.lobby.get().players.map((p) => p.colorIndex));
    for (let i = 0; i < CAR_COLORS.length; i++) {
      const candidate = (Math.abs(requested) + i) % CAR_COLORS.length;
      if (!taken.has(candidate)) return candidate;
    }
    return 0;
  }

  private collectAcks(): Record<PlayerId, number> {
    const acks: Record<PlayerId, number> = {};
    for (const [id, peer] of this.peers) acks[id] = peer.inputs.lastProcessedSeq;
    return acks;
  }

  private lobbyInfo(): LobbyInfo {
    const { trackId, laps, players, status } = this.lobby.get();
    return { trackId, laps, players: [...players], inRace: status === "racing" };
  }

  private broadcastLobby(): void {
    this.broadcast({ type: "lobby", lobby: this.lobbyInfo() });
  }

  private broadcast(message: HostMessage): void {
    const text = encodeMessage(message);
    for (const peer of this.peers.values()) peer.connection.send(text);
  }
}

function send(connection: WebSocketConnection, message: HostMessage): void {
  connection.send(encodeMessage(message));
}
