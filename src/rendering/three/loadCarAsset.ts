import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { utf8Decode } from "@/network/transport/encoding";

import carModel from "../../../assets/models/CarConcept.game.glb";
import { buildCarAsset, type CarAsset } from "./carAsset";

/** `fraction` 0..1 within the car model load. */
export type LoadProgress = (fraction: number, label: string) => void;

let pending: Promise<CarAsset | null> | null = null;

/**
 * Loads and prepares the car model once per app run. Resolves to `null` if anything
 * fails, so the game falls back to the built-in low-poly car instead of crashing.
 * The loading screen calls this first; later callers get the same cached result
 * (and their `onProgress` is ignored).
 */
export function loadCarAsset(onProgress?: LoadProgress): Promise<CarAsset | null> {
  pending ??= load(onProgress ?? (() => {})).catch((error: unknown) => {
    console.warn("Car model failed to load; using the low-poly car.", error);
    return null;
  });
  return pending;
}

async function load(onProgress: LoadProgress): Promise<CarAsset> {
  ensureTextDecoder();
  onProgress(0, "Loading car model");
  const [asset] = await Asset.loadAsync(carModel);
  const bytes = await new File(asset.localUri ?? asset.uri).arrayBuffer();

  onProgress(0.4, "Unpacking car model");
  await nextFrame();
  const gltf = await new GLTFLoader().parseAsync(bytes, "");

  onProgress(0.8, "Preparing cars");
  await nextFrame();
  const car = buildCarAsset(gltf.scene);
  onProgress(1, "Cars ready");
  return car;
}

/** Lets the loading screen paint between heavy synchronous steps. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** GLTFLoader decodes the .glb's JSON chunk with TextDecoder, which Hermes may not provide. */
function ensureTextDecoder(): void {
  if (typeof globalThis.TextDecoder !== "undefined") return;
  class Utf8Decoder {
    readonly encoding = "utf-8";
    decode(input?: ArrayBuffer | ArrayBufferView): string {
      if (!input) return "";
      const bytes =
        input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      return utf8Decode(bytes);
    }
  }
  (globalThis as { TextDecoder?: unknown }).TextDecoder = Utf8Decoder;
}
