import { Box3, Vector3, type BufferGeometry, type Color, type Material, type Mesh, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { CAR_DIMENSIONS } from "@/game/constants/PhysicsConstants";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

import { bakeMeshGeometry } from "./bakeGeometry";

/** What a part of the car is, so the game can restyle it. Decided by glTF material name. */
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

const ROLE_BY_MATERIAL: Record<string, PartRole> = {
  "Paint 1 Carmine": "paint",
  "Paint 2 Carmine": "accent",
  Glass: "glass",
  "": "trim",
  Mechanical: "mechanical",
  Rim2: "rim",
  Rim1: "rimInner",
  Brake: "caliper",
  Disc: "disc",
  Tireside: "tire",
  Tiretread: "tire",
  Mirror: "chrome",
  Headlight: "headlight",
  Brakelight: "taillight",
  Signallight: "signal",
};

const WHEEL_NODE = /^Wheel(Front|Rear)(L|R)$/;

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
 * Models built by scripts/segment-scan-car.mjs name materials "role:<role>";
 * authored models (CarConcept) are mapped by their original material names.
 */
function roleFor(materialName: string): PartRole {
  if (materialName.startsWith("role:")) {
    const role = materialName.slice(5);
    return KNOWN_ROLES.has(role) ? (role as PartRole) : "original";
  }
  return ROLE_BY_MATERIAL[materialName] ?? "original";
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
  parts: CarPart[];
}

/**
 * A car model ready to instance: merged, game-sized geometry facing +X with wheels
 * on y = 0. Geometries are shared by every car (and every GL view), never disposed.
 */
export interface CarAsset {
  body: CarPart[];
  wheels: CarWheelAsset[];
  size: Vector3;
}

/** Geometries flagged with this are shared across cars/views; `disposeScene` skips them. */
export const SHARED_ASSET_FLAG = "sharedCarAsset";

/** Converts a loaded glTF scene (see scripts/optimize-car-model.mjs) into a `CarAsset`. */
export function buildCarAsset(scene: Object3D): CarAsset {
  scene.updateWorldMatrix(true, true);
  const bodyGroups = new Map<string, { role: PartRole; color: number; geometries: BufferGeometry[] }>();
  const wheelGroups = new Map<Object3D, Map<string, { role: PartRole; color: number; geometries: BufferGeometry[] }>>();

  scene.traverse((object) => {
    // three's `isMesh` flag, not `instanceof`: survives duplicate copies of three.
    if (!(object as Mesh).isMesh) return;
    const meshMaterial = (object as Mesh).material;
    const material = (Array.isArray(meshMaterial) ? meshMaterial[0] : meshMaterial) as Material & { color?: Color };
    const role = roleFor(material.name);
    const color = material.color?.getHex() ?? 0x888888;
    const key = role === "original" ? `${role}:${color}` : role;
    const wheel = findWheelAncestor(object);
    const groups = wheel ? getOrCreate(wheelGroups, wheel, () => new Map()) : bodyGroups;
    getOrCreate(groups, key, () => ({ role, color, geometries: [] })).geometries.push(bakeMeshGeometry(object as Mesh));
  });

  const body = [...bodyGroups.values()].map(mergeGroup);
  const wheels = [...wheelGroups.entries()].map(([node, groups]) => ({
    front: /Front/.test(node.name),
    parts: [...groups.values()].map(mergeGroup),
  }));

  // Scale everything to the physics car's length, centred on x/z with wheels on the ground.
  const bounds = new Box3();
  for (const part of [...body, ...wheels.flatMap((w) => w.parts)]) {
    part.geometry.computeBoundingBox();
    bounds.union(part.geometry.boundingBox!);
  }
  const size = bounds.getSize(new Vector3());
  const scale = (CAR_DIMENSIONS.length * S) / size.x;
  const center = bounds.getCenter(new Vector3());
  const toGameSpace = (geometry: BufferGeometry) =>
    geometry.translate(-center.x, -bounds.min.y, -center.z).scale(scale, scale, scale);
  for (const part of body) toGameSpace(part.geometry);

  const wheelAssets: CarWheelAsset[] = wheels.map(({ front, parts }) => {
    const wheelBounds = new Box3();
    for (const part of parts) {
      toGameSpace(part.geometry).computeBoundingBox();
      wheelBounds.union(part.geometry.boundingBox!);
    }
    const wheelCenter = wheelBounds.getCenter(new Vector3());
    for (const part of parts) part.geometry.translate(-wheelCenter.x, -wheelCenter.y, -wheelCenter.z);
    return { front, center: wheelCenter, radius: (wheelBounds.max.y - wheelBounds.min.y) / 2, parts };
  });

  for (const part of [...body, ...wheelAssets.flatMap((w) => w.parts)]) {
    part.geometry.computeBoundingSphere();
    part.geometry.userData[SHARED_ASSET_FLAG] = true;
  }
  return { body, wheels: wheelAssets, size: size.multiplyScalar(scale) };
}

function findWheelAncestor(object: Object3D): Object3D | null {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (WHEEL_NODE.test(node.name)) return node;
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

function mergeGroup(group: { role: PartRole; color: number; geometries: BufferGeometry[] }): CarPart {
  const geometry = group.geometries.length === 1 ? group.geometries[0] : mergeGeometries(group.geometries, false);
  if (!geometry) throw new Error(`Couldn't merge car parts for role "${group.role}".`);
  for (const source of group.geometries) if (source !== geometry) source.dispose();
  return { role: group.role, color: group.color, geometry };
}
