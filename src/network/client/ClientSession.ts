import { CONNECT_TIMEOUT_MS, PROTOCOL_VERSION, ROOM_PORT } from "@/network/constants";
import {
  encodeMessage,
  parseHostMessage,
  type ClientMessage,
  type HostMessage,
  type LobbyInfo,
  type PlayerId,
} from "@/network/protocol";
import { LobbyStore, type MultiplayerSession } from "@/network/session";
import type { CarStyle } from "@/rendering/carStyle";

import { ClientRace } from "./ClientRace";

export interface JoinOptions {
  address: string;
  roomCode: string;
  name: string;
  colorIndex: number;
  style: CarStyle;
  port?: number;
}

/** A joined room: lobby state from the host, then a predicted `ClientRace` once it starts. */
export class ClientSession implements MultiplayerSession {
  readonly role = "client" as const;
  private socket: WebSocket | null = null;
  private playerId: PlayerId | null = null;
  private clientRace: ClientRace | null = null;
  private readonly lobby: LobbyStore;

  constructor(private readonly options: JoinOptions) {
    this.lobby = new LobbyStore({
      status: "connecting",
      roomCode: options.roomCode,
      hostAddresses: [],
      localPlayerId: null,
      trackId: "",
      laps: 0,
      players: [],
      closeReason: null,
    });
  }

  readonly getLobby = () => this.lobby.get();
  readonly subscribe = (listener: () => void) => this.lobby.subscribe(listener);

  get race(): ClientRace | null {
    return this.clientRace;
  }

  /** Resolves when the host accepts us; rejects with a player-facing message otherwise. */
  connect(): Promise<void> {
    const { address, port = ROOM_PORT, name, colorIndex, style } = this.options;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.close(message);
        reject(new Error(message));
      };
      const timer = setTimeout(
        () =>
          fail(
            `No room answered at ${address}. Check the code, and that both phones are on the same Wi-Fi or hotspot.`,
          ),
        CONNECT_TIMEOUT_MS,
      );
      // The platform's reason (e.g. "Connection refused", "No route to host") makes field reports diagnosable.
      const connectFailed = (event: unknown) => {
        const reason = describeSocketError(event);
        fail(`Couldn't connect to ${address}${reason ? ` (${reason})` : ""}.`);
      };

      const socket = new WebSocket(`ws://${address}:${port}`);
      this.socket = socket;
      socket.onopen = () => this.send({ type: "hello", protocol: PROTOCOL_VERSION, name, colorIndex, style });
      socket.onmessage = (event) => {
        const message = typeof event.data === "string" ? parseHostMessage(event.data) : null;
        if (!message) return;
        if (!settled && message.type === "rejected") return fail(message.reason);
        this.handleMessage(message);
        if (!settled && message.type === "welcome") {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };
      socket.onerror = connectFailed;
      socket.onclose = (event) => {
        if (!settled) return connectFailed(event);
        this.close("Lost connection to the host.");
      };
    });
  }

  close(reason = "You left the room."): void {
    if (this.lobby.get().status === "closed") return;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.close();
    }
    this.clientRace?.dispose();
    this.lobby.update({ status: "closed", closeReason: reason });
  }

  private handleMessage(message: HostMessage): void {
    switch (message.type) {
      case "welcome":
        this.playerId = message.playerId;
        this.applyLobby(message.lobby, { localPlayerId: message.playerId });
        break;
      case "lobby":
        this.applyLobby(message.lobby);
        break;
      case "raceStart":
        if (!this.playerId) return;
        this.clientRace?.dispose();
        this.clientRace = new ClientRace(message.race, this.playerId, (inputs) => this.send({ type: "input", inputs }));
        this.lobby.update({ status: "racing" });
        break;
      case "snapshot":
        if (this.clientRace && this.playerId) {
          this.clientRace.applySnapshot(message.tick, message.cars, message.acks[this.playerId] ?? 0, message.race);
        }
        break;
      case "event":
        this.clientRace?.applyEvent(message.event, message.race);
        break;
      case "roomClosed":
        this.close(message.reason);
        break;
      case "rejected":
        this.close(message.reason);
        break;
    }
  }

  private applyLobby(info: LobbyInfo, extra: { localPlayerId?: PlayerId } = {}): void {
    this.lobby.update({
      ...extra,
      status: info.inRace && this.clientRace ? "racing" : "lobby",
      trackId: info.trackId,
      laps: info.laps,
      players: info.players,
    });
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encodeMessage(message));
  }
}

/** React Native puts the native error text on `message` (error events) or `reason` (close events). */
export function describeSocketError(event: unknown): string | null {
  if (typeof event !== "object" || event === null) return null;
  const { message, reason } = event as { message?: unknown; reason?: unknown };
  const text = typeof message === "string" && message ? message : typeof reason === "string" ? reason : "";
  return text.trim() || null;
}
