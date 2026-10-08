/**
 * Turns an AI-generated / scanned car (one mesh, no materials, no normals) into a
 * game-ready model with recolourable parts:
 *
 *   node scripts/segment-scan-car.mjs <input.glb> <output.glb> [--forward=-x|+x|-z|+z]
 *
 * The parts are found from the shape alone:
 * - Wheels: ground-contact clusters at the four corners, then a circle fit for each
 *   tyre. Each wheel becomes its own Wheel{Front,Rear}{L,R} node (so it can spin and steer),
 *   split into tyre / rim / inner rim.
 * - Glass: the cabin above the beltline (where the body narrows), except the roof top.
 * - Lights: forward/backward-facing surfaces at the outer corners of the nose and tail.
 * - Trim: the underside, grille and diffuser. Accent: roof top and side sills.
 * - Everything else: body paint.
 *
 * Output materials are named "role:<role>" (see src/rendering/three/carAsset.ts), and
 * the model is baked facing +X, Y up, wheels on y = 0, 4.4 m long.
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: segment-scan-car.mjs <input.glb> <output.glb> [--forward=-x]");
const forward = (flags.find((f) => f.startsWith("--forward=")) ?? "--forward=-x").split("=")[1];

/** Matches CAR_DIMENSIONS.length (44 world units at 10 units per metre). */
const TARGET_LENGTH = 4.4;
const T = {
  /** Vertices this close to the ground count as tyre contact (m). */
  contactHeight: 0.035,
  wheelRadius: { min: 0.24, max: 0.5, step: 0.004 },
  circleTolerance: 0.014,
  /** Rim/tyre boundary as a fraction of the wheel radius. */
  rimRatio: 0.72,
  /** Beltline = lowest height where the body is this much narrower than at its widest. */
  greenhouseNarrowing: 0.86,
  roofNormalY: 0.8,
  /** Cabin = where the car is at least this fraction of the way from beltline to roof. */
  cabinRise: 0.4,
  /** Roof = flat surfaces within this distance of the highest point (m). */
  roofBand: 0.07,
  /** Anything above the beltline this close to the tail is a wing/ducktail (m). */
  spoilerDepth: 0.45,
  /** Majority-vote passes that clean up jagged part borders. */
  smoothingPasses: 3,
  /** Final triangle budget for the whole car. */
  targetTriangles: Number(process.env.TARGET_TRIANGLES ?? 26000),
  lightNormal: 0.5,
  lightDepth: 0.32,
  sillHeight: 0.3,
  underbodyHeight: 0.1,
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const source = await io.read(input);

// ---------- 1. Collect all triangles in world space ----------
const positions = [];
const indices = [];
source.getRoot().getDefaultScene().traverse((node) => {
  const mesh = node.getMesh();
  if (!mesh) return;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const base = positions.length / 3;
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      positions.push(
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
      );
    }
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < n; i++) indices.push(base + (idx ? idx.getScalar(i) : i));
  }
});
const P = Float32Array.from(positions);
const vertexCount = P.length / 3;
const triCount = indices.length / 3;

// ---------- 2. Orient (nose → +X), scale, ground, centre ----------
for (let i = 0; i < vertexCount; i++) {
  const x = P[i * 3];
  const z = P[i * 3 + 2];
  const [nx, nz] = { "+x": [x, z], "-x": [-x, -z], "+z": [z, -x], "-z": [-z, x] }[forward];
  P[i * 3] = nx;
  P[i * 3 + 2] = nz;
}
const bounds = () => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertexCount; i++)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], P[i * 3 + k]);
      max[k] = Math.max(max[k], P[i * 3 + k]);
    }
  return { min, max };
};
let b = bounds();
const scale = TARGET_LENGTH / (b.max[0] - b.min[0]);
const cx = (b.min[0] + b.max[0]) / 2;
const cz = (b.min[2] + b.max[2]) / 2;
for (let i = 0; i < vertexCount; i++) {
  P[i * 3] = (P[i * 3] - cx) * scale;
  P[i * 3 + 1] = (P[i * 3 + 1] - b.min[1]) * scale;
  P[i * 3 + 2] = (P[i * 3 + 2] - cz) * scale;
}
b = bounds();
const H = b.max[1];
const halfW = Math.max(-b.min[2], b.max[2]);
const xFront = b.max[0];
const xRear = b.min[0];
console.log(`size: L ${(xFront - xRear).toFixed(2)} H ${H.toFixed(2)} W ${(halfW * 2).toFixed(2)} m, ${triCount} triangles`);

// ---------- 3. Wheels ----------
const wheels = [];
for (const [sx, sz, name] of [[1, -1, "WheelFrontL"], [1, 1, "WheelFrontR"], [-1, -1, "WheelRearL"], [-1, 1, "WheelRearR"]]) {
  // Each corner gets its own ground height: scans are often slightly tilted.
  const corner = [];
  for (let i = 0; i < vertexCount; i++) {
    if (P[i * 3] * sx > 0.3 && P[i * 3 + 2] * sz > halfW * 0.5) corner.push(i);
  }
  if (corner.length === 0) throw new Error(`Nothing at the ${name} corner; check --forward.`);
  const ground = Math.min(...corner.map((i) => P[i * 3 + 1]));
  const contact = corner.filter((i) => P[i * 3 + 1] < ground + T.contactHeight);
  const median = (arr) => arr.slice().sort((a, c) => a - c)[Math.floor(arr.length / 2)];
  let x0 = median(contact.map((i) => P[i * 3]));
  const zOut = Math.max(...contact.map((i) => Math.abs(P[i * 3 + 2]))) + 0.02;

  // Fit centre (x, height) and radius: the tread is a circle of radius r around (x0, ground + r).
  const slab = [];
  for (let i = 0; i < vertexCount; i++) {
    const z = Math.abs(P[i * 3 + 2]);
    if (P[i * 3 + 2] * sz > 0 && z > zOut - 0.4 && z < zOut + 0.05 && Math.abs(P[i * 3] - x0) < 0.7 && P[i * 3 + 1] < ground + 1.1) slab.push(i);
  }
  let best = { score: -1, r: 0.35, x: x0, cy: ground + 0.35 };
  for (let dx = -0.12; dx <= 0.12; dx += 0.01) {
    for (let r = T.wheelRadius.min; r <= T.wheelRadius.max; r += T.wheelRadius.step) {
      for (let dy = -0.03; dy <= 0.03; dy += 0.01) {
        const cxw = x0 + dx;
        const cy = ground + r + dy;
        let score = 0;
        for (const i of slab) {
          const d = Math.hypot(P[i * 3] - cxw, P[i * 3 + 1] - cy);
          if (Math.abs(d - r) < T.circleTolerance) score++;
        }
        if (score > best.score) best = { score, r, x: cxw, cy };
      }
    }
  }
  x0 = best.x;
  const { r, cy } = best;
  // Tyre width from the tread's z-extent.
  const tread = slab.filter((i) => Math.abs(Math.hypot(P[i * 3] - x0, P[i * 3 + 1] - cy) - r) < T.circleTolerance);
  const zs = tread.map((i) => Math.abs(P[i * 3 + 2])).sort((a, c) => a - c);
  const zMax = zs[Math.floor(zs.length * 0.98)] + 0.015;
  const zMin = zs[Math.floor(zs.length * 0.02)] - 0.03;
  wheels.push({ name, sz, x0, cy, r, zMin, zMax });
  console.log(
    `${name}: centre x ${x0.toFixed(2)} y ${cy.toFixed(2)} r ${r.toFixed(3)} z ${zMin.toFixed(2)}..${zMax.toFixed(2)} (ground ${ground.toFixed(3)}, fit ${best.score} pts)`,
  );
}

// ---------- 4. Body profile: beltline + roof ----------
const BIN = 0.02;
const widthAt = new Map(); // height bin -> 95th percentile |z|
{
  const bins = new Map();
  for (let i = 0; i < vertexCount; i++) {
    const k = Math.floor(P[i * 3 + 1] / BIN);
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(Math.abs(P[i * 3 + 2]));
  }
  for (const [k, arr] of bins) {
    arr.sort((a, c) => a - c);
    widthAt.set(k, arr[Math.floor(arr.length * 0.95)]);
  }
}
const maxBodyWidth = Math.max(...[...widthAt].filter(([k]) => k * BIN > H * 0.25 && k * BIN < H * 0.6).map(([, w]) => w));
let beltY = H * 0.6;
for (let y = H * 0.4; y < H; y += BIN) {
  if ((widthAt.get(Math.floor(y / BIN)) ?? 0) < maxBodyWidth * T.greenhouseNarrowing) {
    beltY = y;
    break;
  }
}
// Roof top height along the car (per 5 cm of length).
const topAt = new Map();
for (let i = 0; i < vertexCount; i++) {
  const k = Math.floor(P[i * 3] / 0.05);
  topAt.set(k, Math.max(topAt.get(k) ?? 0, P[i * 3 + 1]));
}
const roofMax = Math.max(...topAt.values());
console.log(`beltline ${beltY.toFixed(2)} m (body half-width ${maxBodyWidth.toFixed(2)}), roof ${roofMax.toFixed(2)} m`);
if (process.env.DEBUG_PROFILE) {
  const keys = [...topAt.keys()].sort((a, c) => a - c).filter((k) => k % 2 === 0);
  console.log("top profile (x: height):", keys.map((k) => `${(k * 0.05).toFixed(1)}:${topAt.get(k).toFixed(2)}`).join(" "));
}
// The cabin is the continuous stretch around the highest point that stays well above the
// beltline. Continuity matters: a rear wing can be as tall as the rear window, but the
// trunk dip between them stops the cabin there.
const cabinThreshold = beltY + T.cabinRise * (roofMax - beltY);
const roofKey = [...topAt].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
let cabinFrom = roofKey;
let cabinTo = roofKey;
while ((topAt.get(cabinFrom - 1) ?? 0) >= cabinThreshold) cabinFrom--;
while ((topAt.get(cabinTo + 1) ?? 0) >= cabinThreshold) cabinTo++;
const cabinMinX = cabinFrom * 0.05;
const cabinMaxX = (cabinTo + 1) * 0.05;
console.log(`cabin x ${cabinMinX.toFixed(2)}..${cabinMaxX.toFixed(2)} (above ${cabinThreshold.toFixed(2)} m)`);

// ---------- 5. Simplify the whole shell first (one surface = no seams to crack) ----------
const { indices: simplified, error } = await simplifyShell(P, Uint32Array.from(indices));
const triCountOut = simplified.length / 3;
console.log(`simplified ${triCount} → ${triCountOut} triangles (error ${error.toFixed(4)})`);

// ---------- 6. Classify every triangle ----------
const role = new Array(triCountOut);
const wheelOf = new Int8Array(triCountOut).fill(-1);
const counts = {};
for (let t = 0; t < triCountOut; t++) {
  const a = simplified[t * 3], c = simplified[t * 3 + 1], d = simplified[t * 3 + 2];
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const ux = P[c * 3] - ax, uy = P[c * 3 + 1] - ay, uz = P[c * 3 + 2] - az;
  const vx = P[d * 3] - ax, vy = P[d * 3 + 1] - ay, vz = P[d * 3 + 2] - az;
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  const x = (ax + P[c * 3] + P[d * 3]) / 3;
  const y = (ay + P[c * 3 + 1] + P[d * 3 + 1]) / 3;
  const z = (az + P[c * 3 + 2] + P[d * 3 + 2]) / 3;
  const absZ = Math.abs(z);
  let r = "paint";

  for (let w = 0; w < wheels.length; w++) {
    const wh = wheels[w];
    if (z * wh.sz <= 0 || absZ < wh.zMin || absZ > wh.zMax) continue;
    const dist = Math.hypot(x - wh.x0, y - wh.cy);
    if (dist > wh.r * 1.03) continue;
    wheelOf[t] = w;
    if (dist > wh.r * T.rimRatio) r = "tire";
    else r = absZ > wh.zMax - (wh.zMax - wh.zMin) * 0.45 ? "rim" : "rimInner";
    break;
  }

  if (wheelOf[t] < 0) {
    const inCabin = x >= cabinMinX && x <= cabinMaxX;
    if (y < T.underbodyHeight || ny < -0.6) r = "trim";
    // Roof panel: flat AND near the very top (shallow rear windows are flat but lower).
    else if (inCabin && ny > T.roofNormalY && y > roofMax - T.roofBand) r = "accent";
    // Rear wing / ducktail above the beltline at the very back.
    else if (y > beltY && x < xRear + T.spoilerDepth) r = "accent";
    else if (inCabin && y > beltY + 0.01 && absZ < maxBodyWidth * T.greenhouseNarrowing) r = "glass";
    else if (nx > T.lightNormal && x > xFront - T.lightDepth && y > H * 0.3 && y < beltY && absZ > halfW * 0.45) r = "headlight";
    else if (nx < -T.lightNormal && x < xRear + T.lightDepth && y > H * 0.35 && y < beltY + 0.05 && absZ > halfW * 0.3) r = "taillight";
    else if (nx > T.lightNormal && x > xFront - T.lightDepth && y < H * 0.4 && absZ < halfW * 0.6) r = "trim"; // grille
    else if (nx < -T.lightNormal && x < xRear + T.lightDepth && y < H * 0.3) r = "trim"; // diffuser
    else if (y < T.sillHeight && Math.abs(nz) > 0.6 && Math.abs(x) < (xFront - xRear) * 0.3) r = "accent"; // side sills
  }
  role[t] = r;
}

// ---------- 7. Smooth part boundaries ----------
// Per-triangle rules leave spikes and specks along borders; a triangle whose
// neighbours mostly agree on a different body part joins them. Wheels are exact already.
{
  const edgeOwner = new Map();
  const neighbours = Array.from({ length: triCountOut }, () => []);
  for (let t = 0; t < triCountOut; t++) {
    for (let k = 0; k < 3; k++) {
      const a = simplified[t * 3 + k];
      const c = simplified[t * 3 + ((k + 1) % 3)];
      const key = a < c ? `${a}_${c}` : `${c}_${a}`;
      const other = edgeOwner.get(key);
      if (other === undefined) edgeOwner.set(key, t);
      else {
        neighbours[t].push(other);
        neighbours[other].push(t);
      }
    }
  }
  let changed = 0;
  for (let pass = 0; pass < T.smoothingPasses; pass++) {
    const next = role.slice();
    for (let t = 0; t < triCountOut; t++) {
      if (wheelOf[t] >= 0 || neighbours[t].length < 2) continue;
      const votes = new Map();
      for (const n of neighbours[t]) if (wheelOf[n] < 0) votes.set(role[n], (votes.get(role[n]) ?? 0) + 1);
      let winner = role[t];
      let best = votes.get(role[t]) ?? 0;
      for (const [candidate, count] of votes) if (count > best) [winner, best] = [candidate, count];
      if (winner !== role[t] && best >= 2) {
        next[t] = winner;
        changed++;
      }
    }
    for (let t = 0; t < triCountOut; t++) role[t] = next[t];
  }
  console.log(`smoothed ${changed} boundary triangles`);
}
for (let t = 0; t < triCountOut; t++) counts[role[t]] = (counts[role[t]] ?? 0) + 1;
console.log("triangles per role:", JSON.stringify(counts));

// ---------- 6. Build the output document ----------
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("Scene");
doc.getRoot().setDefaultScene(scene);
const carRoot = doc.createNode("Car");
scene.addChild(carRoot);
// The game restyles every role at runtime; these colours just make the file
// readable in other glTF viewers (and keep materials distinct for dedup).
const PREVIEW_COLORS = {
  paint: [0.75, 0.08, 0.1, 1],
  accent: [0.08, 0.08, 0.09, 1],
  glass: [0.05, 0.08, 0.12, 1],
  trim: [0.04, 0.04, 0.04, 1],
  headlight: [0.95, 0.97, 1, 1],
  taillight: [0.9, 0.05, 0.05, 1],
  tire: [0.02, 0.02, 0.02, 1],
  rim: [0.78, 0.8, 0.84, 1],
  rimInner: [0.15, 0.15, 0.16, 1],
};
const materials = new Map();
const material = (name) => {
  if (!materials.has(name)) {
    materials.set(name, doc.createMaterial(`role:${name}`).setBaseColorFactor(PREVIEW_COLORS[name] ?? [0.8, 0.8, 0.8, 1]));
  }
  return materials.get(name);
};

function buildMesh(name, filter) {
  const mesh = doc.createMesh(name);
  const groups = new Map();
  for (let t = 0; t < triCountOut; t++) {
    if (!filter(t)) continue;
    if (!groups.has(role[t])) groups.set(role[t], []);
    groups.get(role[t]).push(t);
  }
  for (const [roleName, tris] of groups) {
    const remap = new Map();
    const pos = [];
    const idx = new Uint32Array(tris.length * 3);
    tris.forEach((t, j) => {
      for (let k = 0; k < 3; k++) {
        const v = simplified[t * 3 + k];
        let n = remap.get(v);
        if (n === undefined) {
          n = pos.length / 3;
          remap.set(v, n);
          pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
        }
        idx[j * 3 + k] = n;
      }
    });
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(Float32Array.from(pos)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer))
      .setMaterial(material(roleName));
    mesh.addPrimitive(prim);
  }
  return mesh;
}

carRoot.addChild(doc.createNode("Body").setMesh(buildMesh("Body", (t) => wheelOf[t] < 0)));
wheels.forEach((wh, w) => carRoot.addChild(doc.createNode(wh.name).setMesh(buildMesh(wh.name, (t) => wheelOf[t] === w))));

// Role materials are told apart by name; never merge them.
await doc.transform(dedup({ keepUniqueNames: true }), prune());
await io.write(output, doc);
console.log(`wrote ${output}: ${triCountOut} triangles, materials: ${[...materials.keys()].join(", ")}`);

/**
 * Welds coincident vertices (scans often duplicate them along seams, which would
 * stop the simplifier collapsing edges) then simplifies the whole shell to the budget.
 */
async function simplifyShell(positions, triangleIndices) {
  const key = (i) => `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
  const canonical = new Map();
  const welded = new Uint32Array(triangleIndices.length);
  for (let i = 0; i < triangleIndices.length; i++) {
    const v = triangleIndices[i];
    const k = key(v);
    let c = canonical.get(k);
    if (c === undefined) {
      c = v;
      canonical.set(k, v);
    }
    welded[i] = c;
  }
  await MeshoptSimplifier.ready;
  const target = Math.min(triangleIndices.length, T.targetTriangles * 3);
  const [result, resultError] = MeshoptSimplifier.simplify(welded, positions, 3, target, 0.01, []);
  return { indices: result, error: resultError };
}
