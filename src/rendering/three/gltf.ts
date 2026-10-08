import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { utf8Decode } from "@/network/transport/encoding";

/** Reads a bundled asset (a `require`/`import` of a .glb) into memory. */
export async function readAssetBytes(moduleId: number): Promise<ArrayBuffer> {
  const [asset] = await Asset.loadAsync(moduleId);
  return new File(asset.localUri ?? asset.uri).arrayBuffer();
}

/**
 * Parses a binary glTF. Textures are not supported on React Native (no image
 * decoding), so models should be untextured, like the ones in assets/models.
 */
export async function parseGltf(bytes: ArrayBuffer): Promise<Group> {
  ensureTextDecoder();
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  return gltf.scene;
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

/** Lets a loading screen paint between heavy synchronous steps. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
