import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  type ColorRepresentation,
} from "three";

import { CAR_DIMENSIONS } from "@/game/constants/PhysicsConstants";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

const LENGTH = CAR_DIMENSIONS.length * S;
const WIDTH = CAR_DIMENSIONS.width * S;

const WHEEL_RADIUS = 0.36;
const WHEEL_WIDTH = 0.32;
const WHEEL_SEGMENTS = 14;
const WHEELBASE_RATIO = 0.62;
const BODY_HEIGHT = 0.55;
const BODY_BOTTOM = 0.28;
const CABIN = { lengthRatio: 0.42, height: 0.45, widthRatio: 0.78, offsetX: -0.25 } as const;
const SPOILER = { height: 1.2, thickness: 0.06, chord: 0.4, postSize: 0.08 } as const;
const LIGHT = { size: 0.18, inset: 0.35 } as const;
const FLAME = { radius: 0.16, length: 0.9, inset: 0.4 } as const;
const SHADOW = { scale: 1.15, opacity: 0.35, y: 0.045 } as const;
const MAX_WHEEL_STEER = 0.45;
const MAX_BODY_ROLL = 0.06;

const COLORS = {
  wheel: "#151515",
  glass: "#1b2633",
  spoiler: "#222222",
  headlight: "#fff6c2",
  taillight: "#ff2a2a",
  flame: "#ffb020",
  shadow: "#000000",
} as const;

/** A car built from primitives, facing +x, origin at ground level under its centre. */
export class CarModel {
  readonly root = new Group();
  /** Rolls in corners; wheels and shadow stay level. */
  private readonly body = new Group();
  private readonly frontWheels: Group[] = [];
  private readonly flames: Mesh[] = [];

  constructor(color: ColorRepresentation) {
    const paint = new MeshLambertMaterial({ color });
    const dark = new MeshLambertMaterial({ color: COLORS.spoiler });

    const chassis = new Mesh(new BoxGeometry(LENGTH, BODY_HEIGHT, WIDTH * 0.92), paint);
    chassis.position.y = BODY_BOTTOM + BODY_HEIGHT / 2;

    const cabin = new Mesh(
      new BoxGeometry(LENGTH * CABIN.lengthRatio, CABIN.height, WIDTH * CABIN.widthRatio),
      new MeshLambertMaterial({ color: COLORS.glass }),
    );
    cabin.position.set(CABIN.offsetX, BODY_BOTTOM + BODY_HEIGHT + CABIN.height / 2, 0);

    const wing = new Mesh(new BoxGeometry(SPOILER.chord, SPOILER.thickness, WIDTH * 0.95), dark);
    const rearX = -LENGTH / 2 + SPOILER.chord / 2;
    wing.position.set(rearX, SPOILER.height, 0);
    const postGeometry = new BoxGeometry(SPOILER.postSize, SPOILER.height - BODY_BOTTOM - BODY_HEIGHT, SPOILER.postSize);
    for (const z of [-WIDTH * 0.3, WIDTH * 0.3]) {
      const post = new Mesh(postGeometry, dark);
      post.position.set(rearX, (SPOILER.height + BODY_BOTTOM + BODY_HEIGHT) / 2, z);
      this.body.add(post);
    }

    this.body.add(chassis, cabin, wing);
    this.addLights();
    this.addFlames();
    this.addWheels();
    this.root.add(this.body, createShadow());
  }

  /**
   * Applies a pose (scene metres, heading in radians as in the 2D world) and
   * cosmetic state. `steer` is -1..1, `speedRatio` 0..1.
   */
  update(x: number, z: number, heading: number, steer: number, speedRatio: number, boosting: boolean): void {
    this.root.position.set(x, 0, z);
    // 2D heading turns +x toward +y (= scene +z), which is a negative rotation about scene y.
    this.root.rotation.y = -heading;
    // Lean away from the turn: steering right (+z) tips the roof toward -z.
    this.body.rotation.x = -steer * speedRatio * MAX_BODY_ROLL;
    for (const wheel of this.frontWheels) wheel.rotation.y = -steer * MAX_WHEEL_STEER;
    for (const flame of this.flames) {
      flame.visible = boosting;
      if (boosting) flame.scale.y = 0.75 + Math.random() * 0.5; // flicker
    }
  }

  private addWheels(): void {
    // Axle along local z.
    const geometry = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, WHEEL_SEGMENTS).rotateX(Math.PI / 2);
    const material = new MeshLambertMaterial({ color: COLORS.wheel });
    const axleX = (LENGTH * WHEELBASE_RATIO) / 2;
    const trackZ = WIDTH / 2 - WHEEL_WIDTH / 2;
    for (const x of [axleX, -axleX]) {
      for (const z of [-trackZ, trackZ]) {
        const pivot = new Group();
        pivot.position.set(x, WHEEL_RADIUS, z);
        pivot.add(new Mesh(geometry, material));
        this.root.add(pivot);
        if (x > 0) this.frontWheels.push(pivot);
      }
    }
  }

  private addLights(): void {
    const geometry = new BoxGeometry(LIGHT.size / 2, LIGHT.size, LIGHT.size * 1.6);
    const head = new MeshBasicMaterial({ color: COLORS.headlight });
    const tail = new MeshBasicMaterial({ color: COLORS.taillight });
    const y = BODY_BOTTOM + BODY_HEIGHT * 0.65;
    for (const z of [-(WIDTH / 2 - LIGHT.inset), WIDTH / 2 - LIGHT.inset]) {
      const front = new Mesh(geometry, head);
      front.position.set(LENGTH / 2, y, z);
      const rear = new Mesh(geometry, tail);
      rear.position.set(-LENGTH / 2, y, z);
      this.body.add(front, rear);
    }
  }

  private addFlames(): void {
    // Cone tip points along +y; rotate so it points out of the back (-x).
    const geometry = new ConeGeometry(FLAME.radius, FLAME.length, 8).translate(0, FLAME.length / 2, 0).rotateZ(Math.PI / 2);
    const material = new MeshBasicMaterial({ color: COLORS.flame, transparent: true, opacity: 0.85 });
    for (const z of [-FLAME.inset, FLAME.inset]) {
      const flame = new Mesh(geometry, material);
      flame.position.set(-LENGTH / 2, BODY_BOTTOM + 0.15, z);
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
    new MeshBasicMaterial({ color: COLORS.shadow, transparent: true, opacity: SHADOW.opacity, depthWrite: false }),
  );
  shadow.position.y = SHADOW.y;
  return shadow;
}
