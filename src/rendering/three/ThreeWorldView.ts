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

import { pickCarAsset, type CarAssets } from "./loadCarAssets";
import { CarModel } from "./CarModel";
import { ChaseCamera } from "./ChaseCamera";
import { createGLRenderer } from "./createGLRenderer";
import { disposeScene } from "./disposeScene";
import { CAMERA_PRESETS, ENVIRONMENTS, SCENE, type CameraMode } from "./SceneConstants";
import { createScenery } from "./scenery/createScenery";
import { SmokeSystem } from "./SmokeSystem";
import type { SceneryModels } from "./scenery/sceneryModels";
import { createTrackModel } from "./TrackModel";

const SUN_DIRECTION = { x: 0.4, y: 1, z: 0.25 } as const;

export interface ThreeWorldViewOptions {
  /** Index-aligned with `cars`. */
  carLooks: readonly CarLook[];
  cameraMode: CameraMode;
  /** 0..1 fraction of trees/buildings to show. */
  sceneryDensity: number;
}

/** Shared models loaded once per app run (see loading/loadGameAssets.ts). */
export interface WorldAssets {
  /** Each car uses its chosen model; missing models fall back (see `pickCarAsset`). */
  cars: CarAssets;
  scenery: SceneryModels;
}

/** Third-person 3D view rendered with three.js on an expo-gl context. */
export class ThreeWorldView implements WorldView {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly chase: ChaseCamera;
  private readonly carModels: CarModel[];
  private readonly smoke: SmokeSystem;
  private width = 0;
  private height = 0;

  constructor(
    private readonly gl: ExpoWebGLRenderingContext,
    track: Track,
    cars: readonly Car[],
    options: ThreeWorldViewOptions,
    assets: WorldAssets,
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
    scene.add(createScenery(track, palette, assets.scenery, options.sceneryDensity));

    this.carModels = cars.map((car, i) => {
      const look = options.carLooks[i] ?? resolveCarLook(car.slot, DEFAULT_CAR_STYLE);
      return new CarModel(look, pickCarAsset(assets.cars, look.model));
    });
    for (const model of this.carModels) scene.add(model.root);
    this.smoke = new SmokeSystem(cars.length);
    scene.add(this.smoke.object);

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
        car,
        dt,
      );
      this.smoke.emitFromCar(i, pose.x * S, pose.y * S, pose.angle, car.forwardSpeed, car.boosting, dt);
    }

    const target = cars[followIndex];
    const pose = poses[followIndex];
    this.chase.update(pose.x * S, pose.y * S, pose.angle, this.speedRatio(target), target.boosting, target.steer, dt);
    this.smoke.update(dt, this.height, this.chase.camera.fov);

    this.renderer.render(this.scene, this.chase.camera);
    this.gl.endFrameEXP();
  }

  addShake(strength: number): void {
    this.chase.addShake(strength);
  }

  dispose(): void {
    this.smoke.dispose();
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
