import concept from "../../../assets/models/car/CarConcept.game.glb";
import stallion from "../../../assets/models/car/CarConcept2.game.glb";
import raptor from "../../../assets/models/car/CarConcept3.game.glb";
import { CAR_MODELS, type CarModelId } from "@/rendering/carCatalog";

import { buildCarAsset, type CarAsset } from "./carAsset";
import { nextFrame, parseGltf, readAssetBytes } from "./gltf";

/** `fraction` 0..1 within the load. */
export type LoadProgress = (fraction: number, label: string) => void;

/** Game-ready models (see scripts/optimize-car-model.mjs and scripts/segment-scan-car.mjs). */
const FILES: Record<CarModelId, number> = { concept, stallion, raptor };

/** Every car that loaded. A missing entry falls back to another car (or the low-poly one). */
export type CarAssets = Partial<Record<CarModelId, CarAsset>>;

let pending: Promise<CarAssets> | null = null;

/**
 * Loads and prepares every car model once per app run. Never rejects: a model that
 * fails is left out. The loading screen calls this first; later callers share the result.
 */
export function loadCarAssets(onProgress?: LoadProgress): Promise<CarAssets> {
  pending ??= load(onProgress ?? (() => {}));
  return pending;
}

async function load(onProgress: LoadProgress): Promise<CarAssets> {
  const assets: CarAssets = {};
  for (let i = 0; i < CAR_MODELS.length; i++) {
    const { id, name } = CAR_MODELS[i];
    onProgress(i / CAR_MODELS.length, `Loading ${name}`);
    try {
      const scene = await parseGltf(await readAssetBytes(FILES[id]));
      await nextFrame();
      assets[id] = buildCarAsset(scene);
    } catch (error) {
      console.warn(`Car model "${id}" failed to load; it will fall back to another car.`, error);
    }
    await nextFrame();
  }
  onProgress(1, "Cars ready");
  return assets;
}

/** The asset for a car, or the first one that did load, or null (low-poly fallback). */
export function pickCarAsset(assets: CarAssets, model: CarModelId): CarAsset | null {
  return assets[model] ?? Object.values(assets)[0] ?? null;
}
