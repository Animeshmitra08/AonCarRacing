import { PerspectiveCamera } from "three";

import { clamp, lerp, lerpAngle } from "@/game/math/geometry";

import { CHASE_CAMERA as C, type ChaseCameraPreset } from "./SceneConstants";

/**
 * Third-person camera behind the car. Yaw lags the car's heading so it swings
 * wide in corners; distance and FOV grow with speed and boost.
 */
export class ChaseCamera {
  readonly camera = new PerspectiveCamera(C.baseFov, 1, C.near, C.far);
  private yaw = 0;
  private speed = 0;
  private boost = 0;
  private shakeStrength = 0;
  private time = 0;
  private initialized = false;

  constructor(private readonly preset: ChaseCameraPreset) {}

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** `strength` 0..1 */
  addShake(strength: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, clamp(strength, 0, 1));
  }

  /** Target in scene metres; `heading` in radians; `speedRatio` 0..1; `steer` -1..1. */
  update(x: number, z: number, heading: number, speedRatio: number, boosting: boolean, steer: number, dt: number): void {
    if (!this.initialized) {
      this.yaw = heading;
      this.initialized = true;
    }
    this.yaw = lerpAngle(this.yaw, heading, 1 - Math.exp(-C.yawFollowRate * dt));
    const smoothing = 1 - Math.exp(-C.speedSmoothingRate * dt);
    this.speed = lerp(this.speed, clamp(speedRatio, 0, 1), smoothing);
    this.boost = lerp(this.boost, boosting ? 1 : 0, smoothing);

    const fx = Math.cos(this.yaw);
    const fz = Math.sin(this.yaw);
    const { preset } = this;
    const distance = lerp(preset.distance, preset.distanceAtSpeed, this.speed);
    const height = lerp(preset.height, preset.heightAtSpeed, this.speed);

    this.time += dt;
    this.shakeStrength *= Math.exp(-C.shakeDecay * dt);
    const shake = this.shakeStrength * C.shakeAmplitude;
    const phase = this.time * C.shakeFrequency;

    const cam = this.camera;
    cam.position.set(x - fx * distance + Math.sin(phase) * shake, height + Math.cos(phase * 1.3) * shake, z - fz * distance);
    cam.lookAt(x + fx * C.lookAhead, C.lookHeight, z + fz * C.lookAhead);
    cam.rotateZ(-steer * this.speed * C.steerRoll);

    const fov = lerp(C.baseFov, C.speedFov, this.speed) + this.boost * C.boostFov;
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}
