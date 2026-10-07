import { clamp } from "@/game/math/geometry";

export type TiltSensitivity = "low" | "medium" | "high";

/** Tilt angle (radians, rolled like a steering wheel) that gives full lock. */
export const TILT_FULL_LOCK: Record<TiltSensitivity, number> = {
  low: (35 * Math.PI) / 180,
  medium: (25 * Math.PI) / 180,
  high: (16 * Math.PI) / 180,
};

export const TILT = {
  /** Small tilts are ignored so holding the phone "level" means straight. */
  deadZone: (3 * Math.PI) / 180,
  /** Below this in-screen gravity (g), the phone is too flat to read a roll angle. */
  minInPlaneGravity: 0.3,
  /** Exponential smoothing of raw accelerometer samples, per second. */
  smoothingRate: 18,
  updateIntervalMs: 16,
} as const;

/**
 * Steering (-1..1) from the accelerometer's gravity reading while the phone is held
 * in landscape. Uses the roll angle of gravity within the screen plane, so it works:
 * - in either landscape orientation (device x points up or down),
 * - on iOS and Android even though they report opposite signs (the result is unchanged
 *   when both axes flip),
 * - with the phone reclined toward the player (the angle doesn't depend on z).
 *
 * Tilting the right side of the phone down steers right (+).
 */
export function steeringFromGravity(x: number, y: number, fullLock: number): number {
  if (Math.hypot(x, y) < TILT.minInPlaneGravity) return 0;
  const side = x >= 0 ? 1 : -1;
  const roll = Math.atan2(y * side, Math.abs(x));
  const magnitude = Math.abs(roll) - TILT.deadZone;
  if (magnitude <= 0) return 0;
  return clamp((Math.sign(roll) * magnitude) / (fullLock - TILT.deadZone), -1, 1);
}
