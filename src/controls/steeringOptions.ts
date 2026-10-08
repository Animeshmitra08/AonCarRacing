import type { TiltSensitivity } from "./tiltSteering";

/** How the on-screen steering control looks and works. */
export type SteeringControl = "buttons" | "wheel";

export interface SteeringOptions {
  control: SteeringControl;
  /** Steer by tilting the phone. With the wheel control, the wheel shows the tilt and can be grabbed to override it. */
  tilt: boolean;
  tiltSensitivity: TiltSensitivity;
}
