import Matter from "matter-js";

import type { Pose } from "@/game/math/geometry";

export type CarId = string;

/**
 * A car is a Matter body plus the arcade-driving state the controller needs.
 * Position/angle live on the body; we never duplicate them.
 */
export class Car {
  /** Smoothed steering actually applied (input steering is the target). */
  steer = 0;
  /** Signed speed along the car's heading, px/s. Cached for HUD/camera. */
  forwardSpeed = 0;
  /** 0..1 */
  boostEnergy = 1;
  boosting = false;
  /** Pedal state from the last tick, for the head/brake light visuals. */
  accelerating = false;
  braking = false;

  /** Pose at the start of the current tick: used for render interpolation and gate crossing. */
  prevX: number;
  prevY: number;
  prevAngle: number;

  constructor(
    readonly id: CarId,
    /** Index into the grid / colour palette. Stable for the whole race. */
    readonly slot: number,
    readonly body: Matter.Body,
  ) {
    this.prevX = body.position.x;
    this.prevY = body.position.y;
    this.prevAngle = body.angle;
  }

  get x(): number {
    return this.body.position.x;
  }

  get y(): number {
    return this.body.position.y;
  }

  get angle(): number {
    return this.body.angle;
  }

  recordPreviousPose(): void {
    this.prevX = this.body.position.x;
    this.prevY = this.body.position.y;
    this.prevAngle = this.body.angle;
  }

  /** Teleports the car to `pose` and clears all motion (race reset). */
  resetTo(pose: Pose): void {
    Matter.Body.setPosition(this.body, pose);
    Matter.Body.setAngle(this.body, pose.angle);
    Matter.Body.setVelocity(this.body, ZERO_VELOCITY);
    Matter.Body.setAngularVelocity(this.body, 0);
    this.steer = 0;
    this.forwardSpeed = 0;
    this.boostEnergy = 1;
    this.boosting = false;
    this.accelerating = false;
    this.braking = false;
    this.recordPreviousPose();
  }
}

const ZERO_VELOCITY = { x: 0, y: 0 };
