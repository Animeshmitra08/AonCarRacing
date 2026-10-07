import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

import { CAR_DIMENSIONS } from "@/game/constants/PhysicsConstants";
import type { CarLook } from "@/rendering/carStyle";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

import type { CarAsset } from "./carAsset";
import { CarMaterials } from "./carMaterials";

const LENGTH = CAR_DIMENSIONS.length * S;
const WIDTH = CAR_DIMENSIONS.width * S;

const MAX_WHEEL_STEER = 0.45;
const MAX_BODY_ROLL = 0.06;
const FLAME = { radius: 0.14, length: 0.9, height: 0.38, inset: 0.45 } as const;
const SHADOW = { scale: 1.08, opacity: 0.38, y: 0.045 } as const;
const FLAME_COLOR = "#ffb020";

/** Low-poly fallback car, used if the 3D model can't be loaded. */
const FALLBACK = {
  wheelRadius: 0.36,
  wheelWidth: 0.32,
  wheelSegments: 14,
  wheelbaseRatio: 0.62,
  bodyHeight: 0.55,
  bodyBottom: 0.28,
  cabin: { lengthRatio: 0.42, height: 0.45, widthRatio: 0.78, offsetX: -0.25 },
  spoiler: { height: 1.2, thickness: 0.06, chord: 0.4, postSize: 0.08 },
  light: { size: 0.18, inset: 0.35 },
} as const;

/**
 * One car in the 3D scene, facing +x with its origin on the ground under its centre.
 * Built from the shared `CarAsset` when available, otherwise from primitives.
 */
export class CarModel {
  readonly root = new Group();
  /** Rolls in corners; wheels and shadow stay level. */
  private readonly body = new Group();
  private readonly steerPivots: Group[] = [];
  private readonly spinPivots: Group[] = [];
  private readonly flames: Mesh[] = [];
  private readonly materials: CarMaterials;
  private wheelRadius: number = FALLBACK.wheelRadius;
  private wheelAngle = 0;

  constructor(look: CarLook, asset: CarAsset | null) {
    this.materials = new CarMaterials(look);
    if (asset) this.buildFromAsset(asset);
    else this.buildFallback();
    this.addFlames();
    this.root.add(this.body, createShadow());
  }

  setLook(look: CarLook): void {
    this.materials.setLook(look);
  }

  /**
   * Applies a pose (scene metres, heading in radians as in the 2D world) and cosmetic
   * state. `steer` -1..1; `speed` signed m/s along the heading; `speedRatio` 0..1.
   */
  update(
    x: number,
    z: number,
    heading: number,
    steer: number,
    speed: number,
    speedRatio: number,
    boosting: boolean,
    dt: number,
  ): void {
    this.root.position.set(x, 0, z);
    // 2D heading turns +x toward +y (= scene +z), which is a negative rotation about scene y.
    this.root.rotation.y = -heading;
    // Lean away from the turn: steering right (+z) tips the roof toward -z.
    this.body.rotation.x = -steer * speedRatio * MAX_BODY_ROLL;

    for (const pivot of this.steerPivots) pivot.rotation.y = -steer * MAX_WHEEL_STEER;
    // Rolling toward +x turns the wheel clockwise seen from +z, i.e. negative about z.
    this.wheelAngle = (this.wheelAngle - (speed * dt) / this.wheelRadius) % (Math.PI * 2);
    for (const pivot of this.spinPivots) pivot.rotation.z = this.wheelAngle;

    for (const flame of this.flames) {
      flame.visible = boosting;
      if (boosting) flame.scale.y = 0.75 + Math.random() * 0.5; // flicker
    }
  }

  private buildFromAsset(asset: CarAsset): void {
    for (const part of asset.body) {
      this.body.add(new Mesh(part.geometry, this.materials.forRole(part.role, part.color)));
    }
    for (const wheel of asset.wheels) {
      const spin = this.addWheelPivot(wheel.center.x, wheel.center.y, wheel.center.z, wheel.front);
      for (const part of wheel.parts) spin.add(new Mesh(part.geometry, this.materials.forRole(part.role, part.color)));
    }
    this.wheelRadius = asset.wheels[0]?.radius ?? FALLBACK.wheelRadius;
  }

  /** steer pivot (front wheels turn about y) → spin pivot (rolls about z) → wheel meshes. */
  private addWheelPivot(x: number, y: number, z: number, front: boolean): Group {
    const steer = new Group();
    steer.position.set(x, y, z);
    const spin = new Group();
    steer.add(spin);
    this.root.add(steer);
    if (front) this.steerPivots.push(steer);
    this.spinPivots.push(spin);
    return spin;
  }

  private buildFallback(): void {
    const F = FALLBACK;
    const chassis = new Mesh(new BoxGeometry(LENGTH, F.bodyHeight, WIDTH * 0.92), this.materials.paint);
    chassis.position.y = F.bodyBottom + F.bodyHeight / 2;

    const cabin = new Mesh(
      new BoxGeometry(LENGTH * F.cabin.lengthRatio, F.cabin.height, WIDTH * F.cabin.widthRatio),
      this.materials.forRole("glass", 0),
    );
    cabin.position.set(F.cabin.offsetX, F.bodyBottom + F.bodyHeight + F.cabin.height / 2, 0);

    const wing = new Mesh(new BoxGeometry(F.spoiler.chord, F.spoiler.thickness, WIDTH * 0.95), this.materials.accent);
    const rearX = -LENGTH / 2 + F.spoiler.chord / 2;
    wing.position.set(rearX, F.spoiler.height, 0);
    const postGeometry = new BoxGeometry(
      F.spoiler.postSize,
      F.spoiler.height - F.bodyBottom - F.bodyHeight,
      F.spoiler.postSize,
    );
    for (const z of [-WIDTH * 0.3, WIDTH * 0.3]) {
      const post = new Mesh(postGeometry, this.materials.accent);
      post.position.set(rearX, (F.spoiler.height + F.bodyBottom + F.bodyHeight) / 2, z);
      this.body.add(post);
    }
    this.body.add(chassis, cabin, wing);

    const lightGeometry = new BoxGeometry(F.light.size / 2, F.light.size, F.light.size * 1.6);
    const lightY = F.bodyBottom + F.bodyHeight * 0.65;
    for (const z of [-(WIDTH / 2 - F.light.inset), WIDTH / 2 - F.light.inset]) {
      const front = new Mesh(lightGeometry, this.materials.forRole("headlight", 0));
      front.position.set(LENGTH / 2, lightY, z);
      const rear = new Mesh(lightGeometry, this.materials.forRole("taillight", 0));
      rear.position.set(-LENGTH / 2, lightY, z);
      this.body.add(front, rear);
    }

    // Axle along local z.
    const wheelGeometry = new CylinderGeometry(F.wheelRadius, F.wheelRadius, F.wheelWidth, F.wheelSegments).rotateX(
      Math.PI / 2,
    );
    const axleX = (LENGTH * F.wheelbaseRatio) / 2;
    const trackZ = WIDTH / 2 - F.wheelWidth / 2;
    for (const x of [axleX, -axleX]) {
      for (const z of [-trackZ, trackZ]) {
        this.addWheelPivot(x, F.wheelRadius, z, x > 0).add(new Mesh(wheelGeometry, this.materials.forRole("tire", 0)));
      }
    }
  }

  private addFlames(): void {
    // Cone tip points along +y; rotate so it points out of the back (-x).
    const geometry = new ConeGeometry(FLAME.radius, FLAME.length, 8).translate(0, FLAME.length / 2, 0).rotateZ(Math.PI / 2);
    const material = new MeshBasicMaterial({ color: FLAME_COLOR, transparent: true, opacity: 0.85 });
    for (const z of [-FLAME.inset, FLAME.inset]) {
      const flame = new Mesh(geometry, material);
      flame.position.set(-LENGTH / 2, FLAME.height, z);
      flame.visible = false;
      this.flames.push(flame);
      this.body.add(flame);
    }
  }
}

/** Cheap blob shadow instead of real shadow maps. */
function createShadow(): Mesh {
  const shadow = new Mesh(
    new PlaneGeometry(LENGTH * SHADOW.scale, WIDTH * SHADOW.scale).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: SHADOW.opacity, depthWrite: false }),
  );
  shadow.position.y = SHADOW.y;
  return shadow;
}
