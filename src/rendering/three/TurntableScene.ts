import type { ExpoWebGLRenderingContext } from "expo-gl";
import {
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  type WebGLRenderer,
} from "three";

import type { CarLook } from "@/rendering/carStyle";

import type { CarModelId } from "@/rendering/carCatalog";

import { CarModel, type CarEffects } from "./CarModel";
import { pickCarAsset, type CarAssets } from "./loadCarAssets";
import { createGLRenderer } from "./createGLRenderer";
import { disposeScene } from "./disposeScene";

const BACKGROUND = "#1b2033";
const PLATFORM = { radius: 3.4, height: 0.12, color: "#2f3654" } as const;
const CAMERA = { fov: 34, x: 6.5, y: 2.8, z: 6.5, lookAtY: 0.55 } as const;
/** Radians per second. */
const SPIN_SPEED = 0.6;
const MAX_FRAME_SECONDS = 0.1;
/** Parked: no flames, beams or brake lights. */
const PARKED: CarEffects = { boosting: false, accelerating: false, braking: false };

/** A slowly spinning car on a platform, for the garage. Runs its own rAF loop. */
export class TurntableScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private car: CarModel;
  private model: CarModelId;
  private heading = Math.PI / 5;
  private rafId: number | null = null;
  private lastTime = -1;

  constructor(
    private readonly gl: ExpoWebGLRenderingContext,
    look: CarLook,
    private readonly assets: CarAssets,
  ) {
    this.renderer = createGLRenderer(gl);
    this.renderer.setClearColor(BACKGROUND);

    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    this.camera = new PerspectiveCamera(CAMERA.fov, width / Math.max(1, height), 0.1, 100);
    this.camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
    this.camera.lookAt(0, CAMERA.lookAtY, 0);

    this.scene.add(new HemisphereLight("#ffffff", "#30364f", 2));
    const key = new DirectionalLight("#fff2dd", 2.4);
    key.position.set(3, 6, 4);
    this.scene.add(key);

    const platform = new Mesh(
      new CylinderGeometry(PLATFORM.radius, PLATFORM.radius, PLATFORM.height, 48),
      new MeshLambertMaterial({ color: PLATFORM.color }),
    );
    platform.position.y = -PLATFORM.height / 2;
    this.scene.add(platform);

    this.model = look.model;
    this.car = new CarModel(look, pickCarAsset(assets, look.model));
    this.scene.add(this.car.root);
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Recolours in place; a different model swaps the car (keeping its spin angle). */
  setLook(look: CarLook): void {
    if (look.model === this.model) {
      this.car.setLook(look);
      return;
    }
    this.scene.remove(this.car.root);
    disposeScene(this.car.root);
    this.model = look.model;
    this.car = new CarModel(look, pickCarAsset(this.assets, look.model));
    this.scene.add(this.car.root);
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    disposeScene(this.scene);
    this.renderer.dispose();
  }

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const dt = this.lastTime < 0 ? 0 : Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = now;
    this.heading += SPIN_SPEED * dt;
    this.car.update(0, 0, this.heading, 0, 0, 0, PARKED, dt);
    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP();
  };
}
