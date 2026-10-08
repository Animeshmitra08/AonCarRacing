import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";

import type { Track } from "@/game/entities/Track";

import { FALLBACK_TREE, type EnvironmentPalette } from "../SceneConstants";

import { layoutScenery, type Placement } from "./sceneryLayout";
import { SCENERY_MODEL_IDS, type SceneryModelId, type SceneryModels } from "./sceneryModels";

const UP = new Vector3(0, 1, 0);

/**
 * Trees and buildings around the track. Each model type is one InstancedMesh,
 * so the whole scenery costs a handful of draw calls however dense it is.
 */
export function createScenery(
  track: Track,
  palette: EnvironmentPalette,
  models: SceneryModels,
  density: number,
): Group {
  const group = new Group();
  const available = SCENERY_MODEL_IDS.filter((id) => models[id]);
  if (available.length === 0) return createFallbackTrees(track, palette, density);

  const footprints = Object.fromEntries(available.map((id) => [id, models[id]!.radius]));
  const placements = layoutScenery(track, footprints, density);
  // One material for everything: colours come from the models' vertex colours.
  const material = new MeshLambertMaterial({ vertexColors: true });
  for (const id of available) {
    const mine = placements.filter((p) => p.model === id);
    if (mine.length > 0) group.add(createInstances(models[id]!.geometry, material, mine));
  }
  return group;
}

function createInstances(geometry: BufferGeometry, material: Material, placements: readonly Placement[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, placements.length);
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  placements.forEach((p, i) => {
    rotation.setFromAxisAngle(UP, p.yaw);
    matrix.compose(position.set(p.x, 0, p.z), rotation, scale.setScalar(p.scale));
    mesh.setMatrixAt(i, matrix);
  });
  // Instances surround the whole track; per-instance culling isn't worth it here.
  mesh.frustumCulled = false;
  return mesh;
}

/** Cone trees on the same deterministic layout, if no scenery model loaded. */
function createFallbackTrees(track: Track, palette: EnvironmentPalette, density: number): Group {
  const T = FALLBACK_TREE;
  // Every environment's tree layer uses pine and/or tree1; both become cones here.
  const footprints: Partial<Record<SceneryModelId, number>> = { pine: T.foliageRadius, tree1: T.foliageRadius };
  const placements = layoutScenery(track, footprints, density);
  const trunk = new CylinderGeometry(T.trunkRadius, T.trunkRadius, T.trunkHeight, 6).translate(0, T.trunkHeight / 2, 0);
  const foliage = new ConeGeometry(T.foliageRadius, T.foliageHeight, 7).translate(0, T.trunkHeight + T.foliageHeight / 2, 0);
  const group = new Group();
  if (placements.length === 0) return group;
  group.add(
    createInstances(trunk, new MeshLambertMaterial({ color: palette.trunk }), placements),
    createInstances(foliage, new MeshLambertMaterial({ color: palette.foliage }), placements),
  );
  return group;
}
