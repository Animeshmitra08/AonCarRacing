import Matter from "matter-js";

import { DEFAULT_CAR_TUNING, MATTER_VELOCITY_TO_PX_PER_SEC, type CarTuning } from "@/game/constants/PhysicsConstants";
import type { Car } from "@/game/entities/Car";
import { clamp } from "@/game/math/geometry";
import type { CarInput } from "@/game/state/CarInput";

/** Reused to avoid allocating a vector per car per tick. */
const scratchVelocity = { x: 0, y: 0 };

/**
 * Arcade driving model. Reads the post-collision velocity from Matter, splits it
 * into forward/sideways components, applies pedals/steering/grip, and writes it back.
 */
export class CarController {
  constructor(private readonly tuning: CarTuning = DEFAULT_CAR_TUNING) {}

  update(car: Car, input: Readonly<CarInput>, dt: number): void {
    const t = this.tuning;
    const body = car.body;

    const vx = body.velocity.x * MATTER_VELOCITY_TO_PX_PER_SEC;
    const vy = body.velocity.y * MATTER_VELOCITY_TO_PX_PER_SEC;
    let angle = body.angle;
    let fx = Math.cos(angle);
    let fy = Math.sin(angle);

    // Right vector in y-down space is (-fy, fx).
    let forward = vx * fx + vy * fy;
    let lateral = -vx * fy + vy * fx;

    // --- Boost (energy-based so it can later be driven by pickups) ---
    // Boost is its own thrust: it works without the gas pedal. Braking cancels it.
    car.boosting = input.boost && !input.brake && car.boostEnergy > 0;
    if (car.boosting) {
      car.boostEnergy = Math.max(0, car.boostEnergy - t.boost.drainPerSecond * dt);
    } else {
      car.boostEnergy = Math.min(1, car.boostEnergy + t.boost.rechargePerSecond * dt);
    }
    const maxForward = t.maxForwardSpeed * (car.boosting ? t.boost.speedMultiplier : 1);
    const accelMultiplier = car.boosting ? t.boost.accelerationMultiplier : 1;
    const throttle = car.boosting ? 1 : input.throttle;
    car.braking = input.brake;
    car.accelerating = !input.brake && throttle > 0;

    // --- Longitudinal ---
    const before = forward;
    if (input.brake) {
      forward -= (forward > t.reverseEngageSpeed ? t.brakeDeceleration : t.reverseAcceleration) * dt;
      // Never flip from forward to reverse within one tick; stop first.
      if (before > 0 && forward < 0) forward = 0;
    } else if (throttle > 0) {
      if (forward < -t.reverseEngageSpeed) {
        forward += t.brakeDeceleration * dt;
        if (forward > 0) forward = 0;
      } else {
        forward += t.acceleration * accelMultiplier * throttle * dt;
      }
    } else {
      const friction = Math.min(Math.abs(forward), t.rollingFriction * dt);
      forward -= Math.sign(forward) * friction;
    }

    forward -= forward * Math.abs(forward) * t.dragCoefficient * dt;

    if (forward > maxForward) {
      // Above the cap (e.g. boost just ended): never gain speed, bleed off smoothly.
      forward = Math.max(maxForward, Math.min(forward, before) - t.overspeedDeceleration * dt);
    } else if (forward < -t.maxReverseSpeed) {
      forward = -t.maxReverseSpeed;
    }

    // --- Lateral grip: bleed off sideways sliding ---
    lateral *= Math.exp(-t.lateralGrip * dt);

    // --- Steering ---
    const steerBlend = Math.min(1, t.steeringResponse * dt);
    car.steer += (input.steering - car.steer) * steerBlend;

    const speed = Math.abs(forward);
    const lowSpeedAuthority = clamp(speed / t.fullSteerSpeed, 0, 1);
    const highSpeedDamping = 1 - t.highSpeedSteerReduction * clamp(speed / t.maxForwardSpeed, 0, 1);
    const direction = forward >= 0 ? 1 : -1; // steering inverts in reverse, like a real car
    angle += car.steer * t.maxSteerRate * lowSpeedAuthority * highSpeedDamping * direction * dt;

    // Recompose velocity on the new heading so the car follows its nose.
    fx = Math.cos(angle);
    fy = Math.sin(angle);
    scratchVelocity.x = (fx * forward - fy * lateral) / MATTER_VELOCITY_TO_PX_PER_SEC;
    scratchVelocity.y = (fy * forward + fx * lateral) / MATTER_VELOCITY_TO_PX_PER_SEC;

    Matter.Body.setAngle(body, angle);
    Matter.Body.setVelocity(body, scratchVelocity);
    car.forwardSpeed = forward;
  }
}
