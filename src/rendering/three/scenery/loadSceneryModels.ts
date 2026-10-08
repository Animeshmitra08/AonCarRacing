import building1 from "../../../../assets/models/buildings/building1.glb";
import building2 from "../../../../assets/models/buildings/building2.glb";
import building3 from "../../../../assets/models/buildings/building3.glb";
import pine from "../../../../assets/models/trees/tall-pine-tree.glb";
import tree1 from "../../../../assets/models/trees/tree1.glb";
import tree2 from "../../../../assets/models/trees/tree2.glb";
import { nextFrame, parseGltf, readAssetBytes } from "../gltf";
import type { LoadProgress } from "../loadCarAssets";

import { buildSceneryModel, SCENERY_MODEL_IDS, type SceneryModelId, type SceneryModels } from "./sceneryModels";

const FILES: Record<SceneryModelId, number> = { tree1, tree2, pine, building1, building2, building3 };

let pending: Promise<SceneryModels> | null = null;

/**
 * Loads every scenery model once per app run. A model that fails is just left out
 * (the layout uses the others); if all fail, tracks fall back to simple cone trees.
 */
export function loadSceneryModels(onProgress?: LoadProgress): Promise<SceneryModels> {
  pending ??= load(onProgress ?? (() => {}));
  return pending;
}

async function load(onProgress: LoadProgress): Promise<SceneryModels> {
  const models: SceneryModels = {};
  for (let i = 0; i < SCENERY_MODEL_IDS.length; i++) {
    const id = SCENERY_MODEL_IDS[i];
    onProgress(i / SCENERY_MODEL_IDS.length, "Loading scenery");
    try {
      models[id] = buildSceneryModel(await parseGltf(await readAssetBytes(FILES[id])));
    } catch (error) {
      console.warn(`Scenery model "${id}" failed to load; skipping it.`, error);
    }
    await nextFrame();
  }
  onProgress(1, "Scenery ready");
  return models;
}
