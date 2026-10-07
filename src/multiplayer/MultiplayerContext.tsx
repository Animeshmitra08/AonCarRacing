import { createContext, use, useState, useSyncExternalStore, type ReactNode } from "react";

import type { ClientSession } from "@/network/client/ClientSession";
import type { HostSession } from "@/network/host/HostSession";
import type { LobbyView, MultiplayerSession } from "@/network/session";

export type Session = HostSession | ClientSession;

interface MultiplayerContextValue {
  session: Session | null;
  /** Replaces the current session, closing the previous one. */
  setSession: (next: Session | null) => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

/** Keeps the active room alive across the menu → lobby → race screens. */
export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const setSession = (next: Session | null) => {
    if (session && session !== next) session.close();
    setSessionState(next);
  };
  return <MultiplayerContext value={{ session, setSession }}>{children}</MultiplayerContext>;
}

export function useMultiplayer(): MultiplayerContextValue {
  const context = use(MultiplayerContext);
  if (!context) throw new Error("useMultiplayer must be used inside <MultiplayerProvider>.");
  return context;
}

export function useLobby(session: MultiplayerSession): LobbyView {
  return useSyncExternalStore(session.subscribe, session.getLobby);
}
