import { createContext, use, useEffect, useState, type ReactNode } from "react";

import { createDebouncedWriter, STORAGE_KEYS } from "@/storage/secureJson";

import type { GameSettings } from "./settingsModel";

export { DEFAULT_SETTINGS, LAP_LIMITS, type GameSettings } from "./settingsModel";

const SAVE_DELAY_MS = 500;
const saveSettings = createDebouncedWriter(STORAGE_KEYS.settings, SAVE_DELAY_MS);

interface GameSettingsContextValue {
  settings: GameSettings;
  updateSettings: (patch: Partial<GameSettings>) => void;
}

const GameSettingsContext = createContext<GameSettingsContextValue | null>(null);

/** `initial` comes from storage (see loading/loadPlayerData.ts); changes are saved automatically. */
export function GameSettingsProvider({ initial, children }: { initial: GameSettings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  const updateSettings = (patch: Partial<GameSettings>) => setSettings((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (settings !== initial) saveSettings(settings);
  }, [settings, initial]);

  return <GameSettingsContext value={{ settings, updateSettings }}>{children}</GameSettingsContext>;
}

export function useGameSettings(): GameSettingsContextValue {
  const context = use(GameSettingsContext);
  if (!context) throw new Error("useGameSettings must be used inside <GameSettingsProvider>.");
  return context;
}
