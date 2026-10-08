import type { SteeringControl } from "@/controls/steeringOptions";
import type { TiltSensitivity } from "@/controls/tiltSteering";
import { TRACKS } from "@/game/tracks";
import { sanitizeCarStyle } from "@/rendering/carStyle";
import { CAR_COLORS, type GraphicsQuality } from "@/rendering/RenderConstants";
import type { CameraMode } from "@/rendering/three/SceneConstants";

import { DEFAULT_SETTINGS, LAP_LIMITS, type GameSettings } from "./settingsModel";

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Rebuilds settings from stored JSON, field by field: anything missing, from an
 * older version, or invalid falls back to its default instead of breaking the game.
 */
export function parseSettings(value: unknown): GameSettings {
  if (typeof value !== "object" || value === null) return DEFAULT_SETTINGS;
  const v = value as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const int = (x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : null);
  const laps = int(v.laps);
  const color = int(v.carColorIndex);

  return {
    trackId: TRACKS.some((t) => t.id === v.trackId) ? (v.trackId as string) : d.trackId,
    laps: laps !== null ? Math.min(LAP_LIMITS.max, Math.max(LAP_LIMITS.min, laps)) : d.laps,
    carColorIndex: color !== null && color >= 0 && color < CAR_COLORS.length ? color : d.carColorIndex,
    carStyle: sanitizeCarStyle(v.carStyle),
    cameraMode: oneOf<CameraMode>(v.cameraMode, ["close", "far"], d.cameraMode),
    graphicsQuality: oneOf<GraphicsQuality>(v.graphicsQuality, ["performance", "balanced", "quality"], d.graphicsQuality),
    steeringControl: oneOf<SteeringControl>(v.steeringControl, ["buttons", "wheel"], d.steeringControl),
    tiltSteering: typeof v.tiltSteering === "boolean" ? v.tiltSteering : d.tiltSteering,
    tiltSensitivity: oneOf<TiltSensitivity>(v.tiltSensitivity, ["low", "medium", "high"], d.tiltSensitivity),
  };
}
