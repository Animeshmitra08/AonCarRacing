/**
 * Turns a detailed car .glb into a lightweight in-game model:
 *   node scripts/optimize-car-model.mjs [input.glb] [output.glb]
 *
 * - Removes the interior and hidden parts (never visible from the chase camera).
 * - Removes textures and unused vertex attributes. React Native can't decode glTF
 *   images, and the game restyles every material at runtime anyway.
 * - Removes material extensions such as transmission, which would make three.js
 *   render the whole scene twice per frame.
 * - Simplifies the meshes to a triangle budget that works for 8 cars on a phone.
 * - Bakes orientation: nose toward +X, Y up, wheels on y = 0, centred, length in metres.
 *
 * Material names and the Wheel* node names are kept: the game uses them to pick
 * customisable parts and spinning wheels.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, getBounds, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const INPUT = process.argv[2] ?? "assets/models/CarConcept.glb";
const OUTPUT = process.argv[3] ?? "assets/models/CarConcept.game.glb";

/** Matches CAR_DIMENSIONS.length (44 world units at 10 units per metre). */
const TARGET_LENGTH_METERS = 4.4;
/** Nodes (and their children) that are never visible from the chase camera. */
const REMOVED_NODES = /^(Interior|Engine|Axles|License Plate|BodyWindshieldWipers|BodyHoodInterior|BodyHoodUnder)/;
/** Node whose position tells us which end of the car is the front. */
const FRONT_MARKER = "BodyHeadlights";
/** Meshoptimizer settings: keep at most this fraction of triangles, within this relative error. */
const SIMPLIFY = {
  ratio: Number(process.env.SIMPLIFY_RATIO ?? 0.1),
  error: Number(process.env.SIMPLIFY_ERROR ?? 0.003),
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

const countTriangles = () =>
  root
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3, 0);
const report = (label) =>
  console.log(
    `${label.padEnd(22)} nodes ${String(root.listNodes().length).padStart(3)}  meshes ${String(root.listMeshes().length).padStart(3)}  ` +
      `materials ${String(root.listMaterials().length).padStart(2)}  textures ${String(root.listTextures().length).padStart(2)}  ` +
      `triangles ${Math.round(countTriangles())}`,
  );
report("input");

// 1. Orientation, measured before anything is removed.
const before = getBounds(scene);
const center = before.min.map((min, i) => (min + before.max[i]) / 2);
const marker = root.listNodes().find((node) => node.getName() === FRONT_MARKER);
if (!marker) throw new Error(`No "${FRONT_MARKER}" node: can't tell which way the car faces.`);
const markerBounds = getBounds(marker);
const markerCenter = markerBounds.min.map((min, i) => (min + markerBounds.max[i]) / 2);
const toFront = [markerCenter[0] - center[0], markerCenter[2] - center[2]];
// Snap to the dominant horizontal axis; the model is authored axis-aligned.
const forward = Math.abs(toFront[0]) >= Math.abs(toFront[1]) ? [Math.sign(toFront[0]), 0] : [0, Math.sign(toFront[1])];
// A right-handed rotation by `yaw` about +Y maps (x, z) to (x cos + z sin, z cos - x sin),
// so yaw = atan2(fz, fx) maps `forward` onto +X.
const yaw = Math.atan2(forward[1], forward[0]);
const length = forward[0] !== 0 ? before.max[0] - before.min[0] : before.max[2] - before.min[2];

// 2. Remove hidden parts.
for (const node of root.listNodes()) {
  if (REMOVED_NODES.test(node.getName())) node.dispose();
}

// 3. Remove textures (and the emissive glow they masked), unused attributes and material extensions.
for (const material of root.listMaterials()) {
  if (material.getEmissiveTexture()) material.setEmissiveFactor([0, 0, 0]);
  material
    .setBaseColorTexture(null)
    .setNormalTexture(null)
    .setOcclusionTexture(null)
    .setEmissiveTexture(null)
    .setMetallicRoughnessTexture(null);
}
for (const extension of root.listExtensionsUsed()) extension.dispose();
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const semantic of prim.listSemantics()) {
      if (semantic !== "POSITION" && semantic !== "NORMAL") prim.setAttribute(semantic, null);
    }
  }
}
await doc.transform(prune());
report("hidden parts removed");

// 4. Simplify.
await MeshoptSimplifier.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ...SIMPLIFY }), dedup(), prune());
report("simplified");

// 5. Bake the transform under a new root: rotate, scale, then ground and centre.
const carRoot = doc.createNode("Car");
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  carRoot.addChild(child);
}
scene.addChild(carRoot);
const scale = TARGET_LENGTH_METERS / length;
carRoot.setRotation([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]).setScale([scale, scale, scale]);
const placed = getBounds(scene);
carRoot.setTranslation([
  -(placed.min[0] + placed.max[0]) / 2,
  -placed.min[1],
  -(placed.min[2] + placed.max[2]) / 2,
]);

const final = getBounds(scene);
const size = final.max.map((max, i) => max - final.min[i]);
console.log(`forward axis was ${forward[0] ? (forward[0] > 0 ? "+X" : "-X") : forward[1] > 0 ? "+Z" : "-Z"}; scale ${scale.toFixed(4)}`);
console.log(`final size (m): length ${size[0].toFixed(2)}  height ${size[1].toFixed(2)}  width ${size[2].toFixed(2)}`);
console.log("materials:", root.listMaterials().map((m) => m.getName() || "(unnamed)").join(", "));
console.log(
  "wheels:",
  root
    .listNodes()
    .map((n) => n.getName())
    .filter((n) => /^Wheel(Front|Rear)(L|R)$/.test(n))
    .join(", "),
);

await io.write(OUTPUT, doc);
console.log(`wrote ${OUTPUT}`);
