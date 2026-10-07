import type { LobbyPlayer, PlayerId } from "./protocol";

export type SessionStatus = "connecting" | "lobby" | "racing" | "closed";

/** What the lobby/race UI shows. Immutable snapshots, so it works with useSyncExternalStore. */
export interface LobbyView {
  status: SessionStatus;
  /** Null on the host while it has no reachable address (Wi-Fi and hotspot both off). */
  roomCode: string | null;
  /** Host only: every address players could use, best first (shown as a fallback). */
  hostAddresses: readonly string[];
  localPlayerId: PlayerId | null;
  trackId: string;
  laps: number;
  players: readonly LobbyPlayer[];
  closeReason: string | null;
}

export interface MultiplayerSession {
  readonly role: "host" | "client";
  getLobby(): LobbyView;
  subscribe(listener: () => void): () => void;
  close(reason?: string): void;
}

/** Holds the current `LobbyView` and notifies subscribers when it's replaced. */
export class LobbyStore {
  private view: LobbyView;
  private readonly listeners = new Set<() => void>();

  constructor(initial: LobbyView) {
    this.view = initial;
  }

  readonly get = (): LobbyView => this.view;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(patch: Partial<LobbyView>): void {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
}
