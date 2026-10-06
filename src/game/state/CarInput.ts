import { clamp } from "@/game/math/geometry";

/**
 * Everything a driver can do in one tick. Plain and serializable on purpose:
 * this is the shape local controls produce today and network packets carry later.
 */
export interface CarInput {
  /** 0..1 */
  throttle: number;
  /** -1 (left) .. 1 (right) */
  steering: number;
  /** Brakes while moving forward, reverses when (nearly) stopped. */
  brake: boolean;
  boost: boolean;
}

export function createNeutralInput(): CarInput {
  return { throttle: 0, steering: 0, brake: false, boost: false };
}

export const NEUTRAL_INPUT: Readonly<CarInput> = Object.freeze(createNeutralInput());

/** Copies with clamping, so untrusted (e.g. network) input can't exceed limits. */
export function copyInput(source: Readonly<CarInput>, target: CarInput): void {
  target.throttle = Number.isFinite(source.throttle) ? clamp(source.throttle, 0, 1) : 0;
  target.steering = Number.isFinite(source.steering) ? clamp(source.steering, -1, 1) : 0;
  target.brake = source.brake === true;
  target.boost = source.boost === true;
}
