import type { SteeringControl } from "@/controls/steeringOptions";
import type { TiltSensitivity } from "@/controls/tiltSteering";
import { TRACKS } from "@/game/tracks";
import { DEFAULT_CAR_STYLE, type CarStyle } from "@/rendering/carStyle";
import type { GraphicsQuality } from "@/rendering/RenderConstants";
import type { CameraMode } from "@/rendering/three/SceneConstants";

/** Chosen on the home screen, read when a race starts. Saved on the device. */
export interface GameSettings {
  trackId: string;
  laps: number;
  carColorIndex: number;
  /** Accent, rims and calipers (paint is `carColorIndex`). */
  carStyle: CarStyle;
  cameraMode: CameraMode;
  graphicsQuality: GraphicsQuality;
  /** On-screen steering: ◀ ▶ buttons or a turnable wheel. */
  steeringControl: SteeringControl;
  /** Steer by tilting the phone (the wheel control, if chosen, shows the tilt). */
  tiltSteering: boolean;
  tiltSensitivity: TiltSensitivity;
}

export const LAP_LIMITS = { min: 1, max: 9 } as const;

export const DEFAULT_SETTINGS: GameSettings = {
  trackId: TRACKS[0].id,
  laps: TRACKS[0].laps,
  carColorIndex: 0,
  carStyle: DEFAULT_CAR_STYLE,
  cameraMode: "close",
  graphicsQuality: "balanced",
  steeringControl: "buttons",
  tiltSteering: false,
  tiltSensitivity: "medium",
};
