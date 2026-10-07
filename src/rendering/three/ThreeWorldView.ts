import type { ExpoWebGLRenderingContext } from "expo-gl";
import { Color, DirectionalLight, Fog, HemisphereLight, Scene, type WebGLRenderer } from "three";

import { DEFAULT_CAR_TUNING } from "@/game/constants/PhysicsConstants";
import type { Car } from "@/game/entities/Car";
import type { Track } from "@/game/entities/Track";
import type { Pose } from "@/game/math/geometry";
import type { GameState } from "@/game/state/GameState";
import { DEFAULT_CAR_STYLE, resolveCarLook, type CarLook } from "@/rendering/carStyle";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";
import type { WorldView } from "@/rendering/WorldView";

import type { CarAsset } from "./carAsset";
import { CarModel } from "./CarModel";
import { ChaseCamera } from "./ChaseCamera";
import { createGLRenderer } from "./createGLRenderer";
import { disposeScene } from "./disposeScene";
import { CAMERA_PRESETS, ENVIRONMENTS, SCENE, type CameraMode } from "./SceneConstants";
import { createTrackModel } from "./TrackModel";

const SUN_DIRECTION = { x: 0.4, y: 1, z: 0.25 } as const;

export interface ThreeWorldViewOptions {
  /** Index-aligned with `cars`. */
  carLooks: readonly CarLook[];
  cameraMode: CameraMode;
}

/** Third-person 3D view rendered with three.js on an expo-gl context. */
export class ThreeWorldView implements WorldView {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly chase: ChaseCamera;
  private readonly carModels: CarModel[];
  private width = 0;
  private height = 0;

  constructor(
    private readonly gl: ExpoWebGLRenderingContext,
    track: Track,
    cars: readonly Car[],
    options: ThreeWorldViewOptions,
    /** Shared detailed car model; `null` uses the low-poly fallback. */
    carAsset: CarAsset | null,
  ) {
    this.renderer = createGLRenderer(gl);
    this.chase = new ChaseCamera(CAMERA_PRESETS[options.cameraMode]);

    const palette = ENVIRONMENTS[track.definition.environment];
    const { scene } = this;
    scene.background = new Color(palette.sky);
    scene.fog = new Fog(palette.sky, palette.fogNear, palette.fogFar);
    scene.add(new HemisphereLight(palette.hemiSky, palette.hemiGround, SCENE.hemiIntensity));
    const sun = new DirectionalLight(SCENE.sun, SCENE.sunIntensity);
    sun.position.set(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z);
    scene.add(sun);
    scene.add(createTrackModel(track, palette));

    this.carModels = cars.map(
      (car, i) => new CarModel(options.carLooks[i] ?? resolveCarLook(car.slot, DEFAULT_CAR_STYLE), carAsset),
    );
    for (const model of this.carModels) scene.add(model.root);

    this.syncSize();
  }

  render(state: GameState, poses: readonly Pose[], followIndex: number, dt: number): void {
    this.syncSize();
    const { cars } = state;

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const pose = poses[i];
      this.carModels[i].update(
        pose.x * S,
        pose.y * S,
        pose.angle,
        car.steer,
        car.forwardSpeed * S,
        this.speedRatio(car),
        car.boosting,
        dt,
      );
    }

    const target = cars[followIndex];
    const pose = poses[followIndex];
    this.chase.update(pose.x * S, pose.y * S, pose.angle, this.speedRatio(target), target.boosting, target.steer, dt);

    this.renderer.render(this.scene, this.chase.camera);
    this.gl.endFrameEXP();
  }

  addShake(strength: number): void {
    this.chase.addShake(strength);
  }

  dispose(): void {
    disposeScene(this.scene);
    this.renderer.dispose();
  }

  private speedRatio(car: Car): number {
    return Math.abs(car.forwardSpeed) / DEFAULT_CAR_TUNING.maxForwardSpeed;
  }

  private syncSize(): void {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = this.gl;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.chase.setAspect(width / Math.max(1, height));
  }
}
