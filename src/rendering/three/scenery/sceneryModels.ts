import type { BufferGeometry, Mesh, Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { bakeMeshGeometry } from "../bakeGeometry";
import { SHARED_ASSET_FLAG } from "../carAsset";

export const SCENERY_MODEL_IDS = ["tree1", "tree2", "pine", "building1", "building2", "building3"] as const;
export type SceneryModelId = (typeof SCENERY_MODEL_IDS)[number];

/**
 * One scenery model as a single vertex-coloured geometry, so every copy in a scene
 * can be drawn with one instanced draw call. Origin at the base centre, +Z = front.
 */
export interface SceneryModel {
  geometry: BufferGeometry;
  /** Horizontal footprint radius around the origin, metres (unscaled). */
  radius: number;
  height: number;
}

export type SceneryModels = Partial<Record<SceneryModelId, SceneryModel>>;

/** Merges every mesh in a loaded glTF scene into one geometry (position, normal, colour). */
export function buildSceneryModel(scene: Object3D): SceneryModel {
  scene.updateWorldMatrix(true, true);
  const parts: BufferGeometry[] = [];
  scene.traverse((object) => {
    // three's `isMesh` flag, not `instanceof`: survives duplicate copies of three.
    if ((object as Mesh).isMesh) parts.push(bakeMeshGeometry(object as Mesh, { withColor: true }));
  });
  if (parts.length === 0) throw new Error("Scenery model has no meshes.");

  const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (!geometry) throw new Error("Couldn't merge scenery model meshes.");
  for (const part of parts) if (part !== geometry) part.dispose();

  const position = geometry.getAttribute("position");
  let radius = 0;
  for (let i = 0; i < position.count; i++) radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData[SHARED_ASSET_FLAG] = true;
  return { geometry, radius, height: geometry.boundingBox!.max.y };
}
