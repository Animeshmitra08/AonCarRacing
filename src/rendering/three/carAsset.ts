import { Box3, Vector3, type BufferGeometry, type Color, type Material, type Mesh, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { CAR_DIMENSIONS } from "@/game/constants/PhysicsConstants";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

import { bakeMeshGeometry } from "./bakeGeometry";

/** What a part of the car is, so the game can restyle it. Decided by glTF material name ("role:<role>"). */
export type PartRole =
  | "paint"
  | "accent"
  | "glass"
  | "trim"
  | "mechanical"
  | "rim"
  | "rimInner"
  | "caliper"
  | "disc"
  | "tire"
  | "chrome"
  | "headlight"
  | "taillight"
  | "signal"
  /** Unknown material: keep its original colour. */
  | "original";

const WHEEL_NODE = /^Wheel(Front|Rear)(L|R)$/;
/** A wheel's caliper assembly, under its wheel node: steers with the wheel but doesn't spin. */
const BRAKE_NODE = /^Brake(Front|Rear)(L|R)$/;

const KNOWN_ROLES = new Set<string>([
  "paint",
  "accent",
  "glass",
  "trim",
  "mechanical",
  "rim",
  "rimInner",
  "caliper",
  "disc",
  "tire",
  "chrome",
  "headlight",
  "taillight",
  "signal",
]);

/**
 * scripts/build-car-model.mjs and scripts/segment-scan-car.mjs name materials
 * "role:<role>"; any other material keeps its own colour.
 */
function roleFor(materialName: string): PartRole {
  const role = materialName.startsWith("role:") ? materialName.slice(5) : "";
  return KNOWN_ROLES.has(role) ? (role as PartRole) : "original";
}

export interface CarPart {
  role: PartRole;
  /** Original material colour; only used for `original` parts. */
  color: number;
  geometry: BufferGeometry;
}

export interface CarWheelAsset {
  front: boolean;
  /** Wheel centre in car space; the wheel's parts are modelled around the origin. */
  center: Vector3;
  radius: number;
  /** Spin with the wheel. */
  parts: CarPart[];
  /** Caliper assembly: steers with the wheel but doesn't spin. Same space as `parts`. */
  brakeParts: CarPart[];
}

/**
 * A car model ready to instance: merged, game-sized geometry facing +X with wheels
 * on y = 0. Geometries are shared by every car (and every GL view), never disposed.
 */
export interface CarAsset {
  body: CarPart[];
  wheels: CarWheelAsset[];
  size: Vector3;
  lamps: CarLamps;
}

/** One point per side, on the lamp's outer face, in car space. Empty if the model has no such lamps. */
export interface CarLamps {
  head: Vector3[];
  tail: Vector3[];
}

/** Geometries flagged with this are shared across cars/views; `disposeScene` skips them. */
export const SHARED_ASSET_FLAG = "sharedCarAsset";

/** Converts a loaded glTF scene (see scripts/build-car-model.mjs) into a `CarAsset`. */
export function buildCarAsset(scene: Object3D): CarAsset {
  scene.updateWorldMatrix(true, true);
  const bodyGroups: PartGroups = new Map();
  const wheelGroups = new Map<Object3D, { spin: PartGroups; brake: PartGroups }>();

  scene.traverse((object) => {
    // three's `isMesh` flag, not `instanceof`: survives duplicate copies of three.
    if (!(object as Mesh).isMesh) return;
    const meshMaterial = (object as Mesh).material;
    const material = (Array.isArray(meshMaterial) ? meshMaterial[0] : meshMaterial) as Material & { color?: Color };
    const role = roleFor(material.name);
    const color = material.color?.getHex() ?? 0x888888;
    const key = role === "original" ? `${role}:${color}` : role;
    const wheel = findAncestor(object, WHEEL_NODE);
    let groups = bodyGroups;
    if (wheel) {
      const wheelParts = getOrCreate(wheelGroups, wheel, () => ({ spin: new Map(), brake: new Map() }));
      groups = findAncestor(object, BRAKE_NODE) ? wheelParts.brake : wheelParts.spin;
    }
    getOrCreate(groups, key, () => ({ role, color, geometries: [] })).geometries.push(bakeMeshGeometry(object as Mesh));
  });

  const body = [...bodyGroups.values()].map(mergeGroup);
  const wheels = [...wheelGroups.entries()].map(([node, { spin, brake }]) => ({
    front: /Front/.test(node.name),
    parts: [...spin.values()].map(mergeGroup),
    brakeParts: [...brake.values()].map(mergeGroup),
  }));
  const allParts = () => [...body, ...wheels.flatMap((w) => [...w.parts, ...w.brakeParts])];

  // Scale everything to the physics car's length, centred on x/z with wheels on the ground.
  const bounds = new Box3();
  for (const part of allParts()) {
    part.geometry.computeBoundingBox();
    bounds.union(part.geometry.boundingBox!);
  }
  const size = bounds.getSize(new Vector3());
  const scale = (CAR_DIMENSIONS.length * S) / size.x;
  const center = bounds.getCenter(new Vector3());
  for (const part of allParts()) {
    part.geometry.translate(-center.x, -bounds.min.y, -center.z).scale(scale, scale, scale);
  }

  const wheelAssets: CarWheelAsset[] = wheels.map(({ front, parts, brakeParts }) => {
    // The spinning parts alone define the wheel's axle and radius.
    const wheelBounds = new Box3();
    for (const part of parts) {
      part.geometry.computeBoundingBox();
      wheelBounds.union(part.geometry.boundingBox!);
    }
    const wheelCenter = wheelBounds.getCenter(new Vector3());
    for (const part of [...parts, ...brakeParts]) part.geometry.translate(-wheelCenter.x, -wheelCenter.y, -wheelCenter.z);
    return { front, center: wheelCenter, radius: (wheelBounds.max.y - wheelBounds.min.y) / 2, parts, brakeParts };
  });

  for (const part of allParts()) {
    part.geometry.computeBoundingSphere();
    part.geometry.userData[SHARED_ASSET_FLAG] = true;
  }
  const lamps = {
    head: lampAnchors(body.filter((part) => part.role === "headlight"), "front"),
    tail: lampAnchors(body.filter((part) => part.role === "taillight"), "rear"),
  };
  return { body, wheels: wheelAssets, size: size.multiplyScalar(scale), lamps };
}

/** Lamp geometry further than this from the car's end (m) is ignored, e.g. a high brake light or mirror indicators. */
const LAMP_DEPTH = 0.6;

/** Each side's (z < 0, z ≥ 0) lamp cluster: its front- or rear-most x, at the cluster's centre height and width. */
function lampAnchors(parts: CarPart[], end: "front" | "rear"): Vector3[] {
  const sign = end === "front" ? 1 : -1;
  const point = new Vector3();
  const forEachPoint = (visit: (p: Vector3) => void) => {
    for (const { geometry } of parts) {
      const position = geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) visit(point.fromBufferAttribute(position, i));
    }
  };
  let extreme = -Infinity;
  forEachPoint((p) => (extreme = Math.max(extreme, p.x * sign)));
  const sides = [new Box3(), new Box3()];
  forEachPoint((p) => {
    if (p.x * sign > extreme - LAMP_DEPTH) sides[p.z < 0 ? 0 : 1].expandByPoint(p);
  });
  return sides
    .filter((box) => !box.isEmpty())
    .map((box) => {
      const center = box.getCenter(new Vector3());
      return center.setX(end === "front" ? box.max.x : box.min.x);
    });
}

interface PartGroup {
  role: PartRole;
  color: number;
  geometries: BufferGeometry[];
}

type PartGroups = Map<string, PartGroup>;

function findAncestor(object: Object3D, name: RegExp): Object3D | null {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (name.test(node.name)) return node;
  }
  return null;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

function mergeGroup(group: PartGroup): CarPart {
  const geometry = group.geometries.length === 1 ? group.geometries[0] : mergeGeometries(group.geometries, false);
  if (!geometry) throw new Error(`Couldn't merge car parts for role "${group.role}".`);
  for (const source of group.geometries) if (source !== geometry) source.dispose();
  return { role: group.role, color: group.color, geometry };
}
