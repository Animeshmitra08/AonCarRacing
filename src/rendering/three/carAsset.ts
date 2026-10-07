import { Box3, BufferGeometry, Color, Float32BufferAttribute, Mesh, Uint32BufferAttribute, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Material, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { CAR_DIMENSIONS } from "@/game/constants/PhysicsConstants";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

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
    const role = ROLE_BY_MATERIAL[material.name] ?? "original";
    const color = material.color?.getHex() ?? 0x888888;
    const key = role === "original" ? `${role}:${color}` : role;
    const wheel = findWheelAncestor(object);
    const groups = wheel ? getOrCreate(wheelGroups, wheel, () => new Map()) : bodyGroups;
    getOrCreate(groups, key, () => ({ role, color, geometries: [] })).geometries.push(bakeGeometry(object as Mesh));
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

/**
 * Copies a mesh's geometry into car space as plain float position/normal + uint32 index,
 * so parts with different source layouts can be merged.
 */
function bakeGeometry(mesh: Mesh): BufferGeometry {
  const source = mesh.geometry;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", toFloat32(source.getAttribute("position")));
  const normal = source.getAttribute("normal");
  if (normal) geometry.setAttribute("normal", toFloat32(normal));

  const count = source.getAttribute("position").count;
  const index = new Uint32Array(source.index ? source.index.count : count);
  for (let i = 0; i < index.length; i++) index[i] = source.index ? source.index.getX(i) : i;
  // A mirrored transform flips triangle winding; flip it back so back-face culling still works.
  if (mesh.matrixWorld.determinant() < 0) {
    for (let i = 0; i < index.length; i += 3) {
      const swap = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = swap;
    }
  }
  geometry.setIndex(new Uint32BufferAttribute(index, 1));
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!normal) geometry.computeVertexNormals();
  return geometry;
}

function toFloat32(attribute: BufferAttribute | InterleavedBufferAttribute): Float32BufferAttribute {
  const out = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    out[i * 3] = attribute.getX(i);
    out[i * 3 + 1] = attribute.getY(i);
    out[i * 3 + 2] = attribute.getZ(i);
  }
  return new Float32BufferAttribute(out, 3);
}
