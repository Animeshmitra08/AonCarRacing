import { createContext, use, useState, type ReactNode } from "react";

import { TRACKS } from "@/game/tracks";
import type { GraphicsQuality } from "@/rendering/RenderConstants";
import type { CameraMode } from "@/rendering/three/SceneConstants";

/** Chosen on the home screen, read when a race starts. */
export interface GameSettings {
  trackId: string;
  laps: number;
  carColorIndex: number;
  cameraMode: CameraMode;
  graphicsQuality: GraphicsQuality;
}

export const LAP_LIMITS = { min: 1, max: 9 } as const;

const DEFAULT_SETTINGS: GameSettings = {
  trackId: TRACKS[0].id,
  laps: TRACKS[0].laps,
  carColorIndex: 0,
  cameraMode: "close",
  graphicsQuality: "balanced",
};

interface GameSettingsContextValue {
  settings: GameSettings;
  updateSettings: (patch: Partial<GameSettings>) => void;
}

const GameSettingsContext = createContext<GameSettingsContextValue | null>(null);

export function GameSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const updateSettings = (patch: Partial<GameSettings>) => setSettings((current) => ({ ...current, ...patch }));
  return <GameSettingsContext value={{ settings, updateSettings }}>{children}</GameSettingsContext>;
}

export function useGameSettings(): GameSettingsContextValue {
  const context = use(GameSettingsContext);
  if (!context) throw new Error("useGameSettings must be used inside <GameSettingsProvider>.");
  return context;
}
