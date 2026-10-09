/**
 * Turns a detailed Blender car export into a lightweight in-game model. Each car has a
 * config in scripts/cars/ saying which parts to drop and what every material is.
 *
 *   node scripts/build-car-model.mjs <config name>...   (e.g. auroGT3, or "all")
 *
 * For single-mesh scans with no materials, use scripts/segment-scan-car.mjs instead.
 *
 * - Removes the interior (hidden behind the opaque in-game glass), hidden lamp internals
 *   and alpha-textured decals. React Native can't decode glTF images, and the game
 *   restyles every part anyway.
 * - Mirrors parts that were exported as one half (an unapplied Blender mirror modifier).
 * - Maps every material to a part role, written as "role:<role>" (see
 *   src/rendering/three/carAsset.ts). An unmapped material is an error, so a re-exported
 *   model can't silently lose its colours.
 * - Puts each wheel's spinning parts under Wheel{Front,Rear}{L,R}, and its caliper
 *   assembly (steers with the wheel, doesn't spin) under a Brake{Front,Rear}{L,R} child.
 * - Merges parts per role and simplifies them to a budget that works for 8 cars on a phone.
 * - Bakes orientation: nose toward +X, Y up, wheels on y = 0, centred, length in metres.
 *
 * Config fields (see scripts/cars/auroGT3.mjs for a complete example):
 * - input, output: .glb paths.
 * - forward: "+x" | "-x" | "+z" | "-z", or { marker: "<node name at the front>" }.
 * - removedNodes: RegExp of node names to drop. droppedMaterials: material names to drop.
 * - mirror: "bodyHalves" mirrors one-sided body parts; "unpaired" mirrors any one-sided
 *   part with no mirror-image twin (for exports where halves are scattered over both sides).
 *   mirrorWheels: false keeps "materials"-mode wheel parts as they are, for exports with all
 *   four wheels whose left and right parts aren't exact mirror images (e.g. caliper angles).
 * - wheels: { mode: "nodes", tireNode, partNode, partRadius, isBrakeMaterial } groups whole
 *   nodes by name; { mode: "materials", tire, spin, brake } assigns each triangle of a wheel
 *   material to the wheel it sits in (for exports with no wheel node names).
 * - roles: material → role. wheelRoles: overrides for wheel parts. nodeRoles: node name →
 *   role overrides for body parts (e.g. a roof panel in the same material as the body).
 *   fixedColors: material → sRGB colour (or null to keep the file's) for parts that ignore
 *   the player's style.
 * - lampsByPosition: headlight/taillight decided by which end of the car the part is on.
 * - liftMaterials: material → metres (source units) to push it out along its normals, for
 *   livery layers lying on the bodywork that would otherwise z-fight with it.
 * - simplifyError: { body, wheel } in metres at game scale.
 * - sloppyMaterials: material → triangle budget, simplified ignoring topology: for
 *   perforated grille meshes, whose holes the normal simplifier must keep.
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { readdir } from "node:fs/promises";

/** Matches CAR_DIMENSIONS.length (44 world units at 10 units per metre). */
const TARGET_LENGTH_METERS = 4.4;
/** Role colours for other glTF viewers only: the game restyles every role at runtime. */
const PREVIEW_COLORS = {
  paint: "#bf141a",
  accent: "#161618",
  glass: "#0d141f",
  trim: "#0b0b0b",
  mechanical: "#1b1c1e",
  headlight: "#f2f7ff",
  taillight: "#e60d0d",
  signal: "#ff9a1a",
  chrome: "#d0d4da",
  tire: "#050505",
  rim: "#c9ced6",
  rimInner: "#262628",
  disc: "#6d7075",
  caliper: "#c8102e",
};
const LAMP_ROLES = new Set(["headlight", "taillight"]);
/** "unpaired" mirroring: how far (m, source units) a twin's bounds may be from an exact mirror image. */
const TWIN_TOLERANCE = 0.04;
/** "materials" wheels: slack (m, source units) around the tyre's width and radius. */
const WHEEL_SLACK = { width: 0.08, radius: 1.05 };

const names = process.argv.slice(2);
if (names.length === 0) throw new Error("usage: build-car-model.mjs <config name>... | all");
const configNames =
  names[0] === "all"
    ? (await readdir(new URL("./cars/", import.meta.url))).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4))
    : names;
await MeshoptSimplifier.ready;
for (const name of configNames) {
  console.log(`\n=== ${name}`);
  const { default: config } = await import(new URL(`./cars/${name}.mjs`, import.meta.url).href);
  await build(config);
}

async function build(config) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const source = await io.read(config.input);
  const sourceRoot = source.getRoot();
  const meshNodes = sourceRoot.listNodes().filter((node) => node.getMesh());
  const countTriangles = (nodes) =>
    nodes
      .flatMap((node) => node.getMesh().listPrimitives())
      .reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3, 0);
  console.log(`input: ${meshNodes.length} meshes, ${sourceRoot.listMaterials().length} materials, ${countTriangles(meshNodes)} triangles`);
  const droppedMaterials = new Set(config.droppedMaterials ?? []);

  // 1. Orientation: nose toward +X.
  const forward = forwardOf(config.forward, sourceRoot);
  /** Source axis across the car: the mirror plane for half-exported parts is at 0 on it. */
  const lateral = forward[0] !== 0 ? 2 : 0;
  // Rotation about +Y that maps `forward` onto +X: (x, z) → (x cos + z sin, z cos - x sin).
  const yaw = Math.atan2(forward[1], forward[0]);
  const [cos, sin] = [Math.cos(yaw), Math.sin(yaw)];
  const rotate = (v) => [v[0] * cos + v[2] * sin, v[1], v[2] * cos - v[0] * sin];

  // 2. Which nodes to keep, and which of them to mirror.
  const keptNodes = meshNodes.filter((node) => !config.removedNodes?.test(node.getName()));
  console.log(`removed ${meshNodes.length - keptNodes.length} nodes`);
  const wheelNodes = config.wheels.mode === "nodes" ? nodeModeWheels(config.wheels, keptNodes) : null;
  const nodeGroup = (node) => (wheelNodes ? nodeModeGroup(config.wheels, wheelNodes, node) : null);
  const mirrored = mirroredNodes(config.mirror, keptNodes, lateral, nodeGroup);
  if (config.mirrorWheels === false) {
    const { tire, spin, brake } = config.wheels;
    const wheelMaterials = new Set([...tire, ...spin, ...brake]);
    for (const node of mirrored) {
      if (node.getMesh().listPrimitives().every((prim) => wheelMaterials.has(prim.getMaterial()?.getName() ?? ""))) mirrored.delete(node);
    }
  }
  console.log(`mirrored ${mirrored.size} half parts`);

  // 3. Every kept primitive (and mirror copy), rotated to face +X, still in source units.
  const pieces = [];
  for (const node of keptNodes) {
    const matrix = node.getWorldMatrix();
    const normalMatrix = normalMatrixOf(matrix);
    const flipped = determinant3(matrix) < 0;
    const group = nodeGroup(node);
    for (const prim of node.getMesh().listPrimitives()) {
      const materialName = prim.getMaterial()?.getName() ?? "";
      if (droppedMaterials.has(materialName)) continue;
      if (prim.getMode() !== 4) {
        console.warn(`skipping non-triangle primitive in "${node.getName()}"`);
        continue;
      }
      const position = prim.getAttribute("POSITION");
      const normal = prim.getAttribute("NORMAL");
      if (!normal) throw new Error(`"${node.getName()}" has no normals; re-export with normals.`);
      const index = prim.getIndices();
      const count = index ? index.getCount() : position.getCount();
      const lift = config.liftMaterials?.[materialName] ?? 0;
      for (const mirror of mirrored.has(node) ? [false, true] : [false]) {
        const positions = [];
        const normals = [];
        const p = [0, 0, 0];
        const n = [0, 0, 0];
        for (let i = 0; i < position.getCount(); i++) {
          const world = transformPoint(matrix, position.getElement(i, p));
          const worldNormal = normalize(transformVector(normalMatrix, normal.getElement(i, n)));
          for (let k = 0; k < 3; k++) world[k] += worldNormal[k] * lift;
          if (mirror) {
            world[lateral] = -world[lateral];
            worldNormal[lateral] = -worldNormal[lateral];
          }
          positions.push(...rotate(world));
          normals.push(...rotate(worldNormal));
        }
        // A mirrored transform flips triangle winding; flip it back so back-face culling still works.
        const flip = flipped !== mirror;
        const indices = [];
        for (let i = 0; i < count; i += 3) {
          const [a, b, c] = [0, 1, 2].map((k) => (index ? index.getScalar(i + k) : i + k));
          indices.push(a, flip ? c : b, flip ? b : c);
        }
        pieces.push({ nodeName: node.getName(), material: prim.getMaterial(), materialName, group, positions, normals, indices });
      }
    }
  }

  // 4. Sort triangles into the body / wheel / brake groups and part roles.
  const wheels = wheelNodes ?? materialModeWheels(config, pieces);
  /** Middle of the car along its length, for lampsByPosition. */
  const carMidX = midpoint(pieces.flatMap((piece) => piece.positions.filter((_, i) => i % 3 === 0)));
  const roleOf = (materialName, group, x, nodeName) => {
    if (group.startsWith("Brake")) return (config.roles[materialName] ?? config.wheelRoles?.[materialName]) === "caliper" ? "caliper" : "mechanical";
    if (materialName in (config.fixedColors ?? {})) return "original";
    const role =
      (group === "Body" ? config.nodeRoles?.[nodeName] : config.wheelRoles?.[materialName]) || config.roles[materialName];
    if (!role) throw new Error(`Material "${materialName}" (${group}) has no role: add it to the config's roles or fixedColors.`);
    if (config.lampsByPosition && LAMP_ROLES.has(role)) return x >= carMidX ? "headlight" : "taillight";
    return role;
  };
  const groupOfTriangle = materialModeTriangleGroup(config, wheels);

  /** key → { group, role, color, materialName, positions: number[], normals: number[], indices: number[] } */
  const buckets = new Map();
  const bucketFor = (piece, group, role) => {
    const color = role === "original" ? originalColor(config, piece.material, piece.materialName) : PREVIEW_COLORS[role];
    const sloppy = config.sloppyMaterials?.[piece.materialName];
    const key = `${group}|${role}|${color}${sloppy ? "|sloppy" : ""}`;
    if (!buckets.has(key)) {
      buckets.set(key, { group, role, color, sloppy, materialName: piece.materialName, positions: [], normals: [], indices: [] });
    }
    return buckets.get(key);
  };
  for (const piece of pieces) {
    const { positions, normals, indices } = piece;
    // Triangles → bucket.
    const triangleBuckets = [];
    for (let t = 0; t < indices.length; t += 3) {
      const centroid = [0, 1, 2].map((k) => (positions[indices[t] * 3 + k] + positions[indices[t + 1] * 3 + k] + positions[indices[t + 2] * 3 + k]) / 3);
      const group = piece.group ?? groupOfTriangle(piece.materialName, centroid);
      triangleBuckets.push(bucketFor(piece, group, roleOf(piece.materialName, group, centroid[0], piece.nodeName)));
    }
    if (triangleBuckets.every((bucket) => bucket === triangleBuckets[0])) {
      // Whole piece in one bucket: copy it as is.
      const bucket = triangleBuckets[0];
      if (!bucket) continue;
      const base = bucket.positions.length / 3;
      // Loops, not push(...array): spreading a big mesh overflows the call stack.
      for (let i = 0; i < positions.length; i++) {
        bucket.positions.push(positions[i]);
        bucket.normals.push(normals[i]);
      }
      for (const v of indices) bucket.indices.push(base + v);
      continue;
    }
    // Split piece: copy only the vertices each bucket uses.
    const remaps = new Map();
    triangleBuckets.forEach((bucket, t) => {
      if (!remaps.has(bucket)) remaps.set(bucket, new Map());
      const remap = remaps.get(bucket);
      for (let k = 0; k < 3; k++) {
        const v = indices[t * 3 + k];
        let target = remap.get(v);
        if (target === undefined) {
          target = bucket.positions.length / 3;
          remap.set(v, target);
          bucket.positions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
          bucket.normals.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
        }
        bucket.indices.push(target);
      }
    });
  }

  // 5. Scale to the game length, wheels on the ground, centred.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { positions } of buckets.values()) {
    for (let i = 0; i < positions.length; i++) {
      min[i % 3] = Math.min(min[i % 3], positions[i]);
      max[i % 3] = Math.max(max[i % 3], positions[i]);
    }
  }
  const scale = TARGET_LENGTH_METERS / (max[0] - min[0]);
  const offset = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
  for (const { positions } of buckets.values()) {
    for (let i = 0; i < positions.length; i++) positions[i] = (positions[i] + offset[i % 3]) * scale;
  }

  // 6. Simplify each bucket and write the output document.
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("Scene");
  doc.getRoot().setDefaultScene(scene);
  const carRoot = doc.createNode("Car");
  scene.addChild(carRoot);

  const groupNodes = new Map([["Body", doc.createNode("Body").setMesh(doc.createMesh("Body"))]]);
  carRoot.addChild(groupNodes.get("Body"));
  for (const wheel of wheels) {
    const wheelNode = doc.createNode(wheel.name).setMesh(doc.createMesh(wheel.name));
    const brakeNode = doc.createNode(wheel.brake).setMesh(doc.createMesh(wheel.brake));
    carRoot.addChild(wheelNode.addChild(brakeNode));
    groupNodes.set(wheel.name, wheelNode).set(wheel.brake, brakeNode);
  }

  const materials = new Map();
  const trianglesPerGroup = {};
  const trianglesPerRole = {};
  for (const bucket of buckets.values()) {
    const error = bucket.group === "Body" ? config.simplifyError.body : config.simplifyError.wheel;
    const { positions, normals, indices } = simplifyBucket(bucket, error);
    if (indices.length === 0) continue;
    const materialName = bucket.role === "original" ? bucket.materialName : `role:${bucket.role}`;
    const materialKey = `${materialName}|${bucket.color}`;
    if (!materials.has(materialKey)) {
      materials.set(materialKey, doc.createMaterial(materialName).setBaseColorFactor([...srgbToLinear(bucket.color), 1]));
    }
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer))
      .setMaterial(materials.get(materialKey));
    groupNodes.get(bucket.group).getMesh().addPrimitive(prim);
    const triangles = indices.length / 3;
    trianglesPerGroup[bucket.group] = (trianglesPerGroup[bucket.group] ?? 0) + triangles;
    trianglesPerRole[bucket.role] = (trianglesPerRole[bucket.role] ?? 0) + triangles;
  }
  for (const node of groupNodes.values()) {
    if (node.getMesh().listPrimitives().length === 0) node.getMesh().dispose();
  }

  const final = getBounds(scene);
  const size = final.max.map((v, i) => v - final.min[i]);
  const total = Object.values(trianglesPerGroup).reduce((a, b) => a + b, 0);
  console.log(`forward axis was ${forward[0] ? (forward[0] > 0 ? "+X" : "-X") : forward[1] > 0 ? "+Z" : "-Z"}; scale ${scale.toFixed(4)}`);
  console.log(`final size (m): length ${size[0].toFixed(2)}  height ${size[1].toFixed(2)}  width ${size[2].toFixed(2)}`);
  console.log("triangles per group:", JSON.stringify(trianglesPerGroup));
  console.log("triangles per role:", JSON.stringify(trianglesPerRole));
  console.log("materials:", [...materials.keys()].map((key) => key.split("|")[0]).join(", "));
  await io.write(config.output, doc);
  console.log(`wrote ${config.output}: ${total} triangles`);
}

// ---------- Orientation ----------

function forwardOf(setting, root) {
  if (typeof setting === "string") {
    const sign = setting[0] === "-" ? -1 : 1;
    return setting[1] === "x" ? [sign, 0] : [0, sign];
  }
  // Snap the direction from the scene centre to the marker to the dominant horizontal axis.
  const sceneBounds = getBounds(root.getDefaultScene() ?? root.listScenes()[0]);
  const sceneCenter = sceneBounds.min.map((v, i) => (v + sceneBounds.max[i]) / 2);
  const marker = root.listNodes().find((node) => node.getName() === setting.marker);
  if (!marker) throw new Error(`No "${setting.marker}" node: can't tell which way the car faces.`);
  const markerCenter = centerOf(getBounds(marker));
  const toFront = [markerCenter[0] - sceneCenter[0], markerCenter[2] - sceneCenter[2]];
  return Math.abs(toFront[0]) >= Math.abs(toFront[1]) ? [Math.sign(toFront[0]), 0] : [0, Math.sign(toFront[1])];
}

// ---------- Mirroring ----------

function mirroredNodes(mode, nodes, lateral, nodeGroup) {
  const result = new Set();
  if (mode === "bodyHalves") {
    // One-sided body parts. Wheels come complete in these exports.
    const tolerance = 0.005;
    for (const node of nodes) {
      const bounds = getBounds(node);
      const group = nodeGroup(node) ?? "Body";
      if (group === "Body" && bounds.min[lateral] > -tolerance && bounds.max[lateral] > tolerance) result.add(node);
    }
  } else if (mode === "unpaired") {
    // One-sided parts (either side) that don't already have a mirror-image twin.
    const tolerance = 0.01;
    const entries = nodes.map((node) => ({ node, bounds: meshBounds(node), triangles: triangleCount(node) }));
    const other = lateral === 0 ? [1, 2] : [0, 1];
    for (const entry of entries) {
      const { min, max } = entry.bounds;
      const oneSided = min[lateral] > -tolerance || max[lateral] < tolerance;
      if (!oneSided || Math.max(Math.abs(min[lateral]), Math.abs(max[lateral])) < tolerance) continue;
      const twin = entries.some(
        (candidate) =>
          candidate !== entry &&
          candidate.triangles === entry.triangles &&
          Math.abs(candidate.bounds.min[lateral] + max[lateral]) < TWIN_TOLERANCE &&
          Math.abs(candidate.bounds.max[lateral] + min[lateral]) < TWIN_TOLERANCE &&
          other.every(
            (k) => Math.abs(candidate.bounds.min[k] - min[k]) < TWIN_TOLERANCE && Math.abs(candidate.bounds.max[k] - max[k]) < TWIN_TOLERANCE,
          ),
      );
      if (!twin) result.add(entry.node);
    }
  } else if (mode !== "none") {
    throw new Error(`Unknown mirror mode "${mode}".`);
  }
  return result;
}

// ---------- Wheels: whole nodes by name ----------

function nodeModeWheels({ tireNode }, nodes) {
  const wheels = nodes
    .filter((node) => tireNode.test(node.getName()))
    .map((node) => {
      const [, end, side] = node.getName().match(tireNode);
      const suffix = `${end === "Ft" ? "Front" : "Rear"}${side}`;
      return { name: `Wheel${suffix}`, brake: `Brake${suffix}`, center: centerOf(getBounds(node)) };
    });
  if (wheels.length !== 4) throw new Error(`Expected 4 wheel nodes, found ${wheels.length}.`);
  return wheels;
}

function nodeModeGroup({ tireNode, partNode, partRadius, isBrakeMaterial }, wheels, node) {
  const name = node.getName();
  if (!tireNode.test(name) && !partNode.test(name)) return "Body";
  const center = centerOf(getBounds(node));
  const nearest = wheels.reduce((best, wheel) => (distance(wheel.center, center) < distance(best.center, center) ? wheel : best));
  if (distance(nearest.center, center) >= partRadius) return "Body";
  const materials = node.getMesh().listPrimitives().map((prim) => prim.getMaterial()?.getName() ?? "");
  return materials.some(isBrakeMaterial) ? nearest.brake : nearest.name;
}

// ---------- Wheels: triangles by material and position ----------

/** The four tyres, from the tyre-material triangles in each corner (car space: +X forward). */
function materialModeWheels({ wheels: { tire } }, pieces) {
  const tirePieces = pieces.filter((piece) => tire.includes(piece.materialName));
  const xs = tirePieces.flatMap((piece) => piece.positions.filter((_, i) => i % 3 === 0));
  if (xs.length === 0) throw new Error("No tyre triangles: check the config's wheels.tire materials.");
  const midX = midpoint(xs);
  const corners = new Map();
  for (const piece of tirePieces) {
    for (let v = 0; v < piece.positions.length; v += 3) {
      const [x, y, z] = piece.positions.slice(v, v + 3);
      const name = `${x >= midX ? "Front" : "Rear"}${z < 0 ? "L" : "R"}`;
      if (!corners.has(name)) corners.set(name, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
      const box = corners.get(name);
      [x, y, z].forEach((c, k) => {
        box.min[k] = Math.min(box.min[k], c);
        box.max[k] = Math.max(box.max[k], c);
      });
    }
  }
  if (corners.size !== 4) throw new Error(`Expected tyres in 4 corners, found ${[...corners.keys()].join(", ")}.`);
  return ["FrontL", "FrontR", "RearL", "RearR"].map((suffix) => {
    const { min, max } = corners.get(suffix);
    return {
      name: `Wheel${suffix}`,
      brake: `Brake${suffix}`,
      center: centerOf({ min, max }),
      radius: (max[1] - min[1]) / 2,
      zMin: min[2],
      zMax: max[2],
    };
  });
}

/** Wheel-material triangles inside a tyre's cylinder belong to that wheel; everything else is body. */
function materialModeTriangleGroup(config, wheels) {
  if (config.wheels.mode !== "materials") return () => "Body";
  const { tire, spin, brake } = config.wheels;
  return (materialName, [x, y, z]) => {
    const isTire = tire.includes(materialName);
    const isBrake = brake.includes(materialName);
    if (!isTire && !isBrake && !spin.includes(materialName)) return "Body";
    const wheel = wheels.find(
      (w) =>
        z > w.zMin - WHEEL_SLACK.width &&
        z < w.zMax + WHEEL_SLACK.width &&
        Math.hypot(x - w.center[0], y - w.center[1]) < w.radius * WHEEL_SLACK.radius,
    );
    if (!wheel) return "Body";
    return isBrake ? wheel.brake : wheel.name;
  };
}

// ---------- Simplification ----------

/**
 * Welds vertices with equal position and normal, then simplifies within `error`.
 * Hard edges keep their split normals: meshoptimizer treats them as seams, and
 * "Permissive" still lets it collapse across them (tyre treads are nothing but seams).
 */
function simplifyBucket({ positions, normals, indices, sloppy }, error) {
  const unique = new Map();
  const weldedPositions = [];
  const weldedNormals = [];
  const remap = new Uint32Array(positions.length / 3);
  for (let v = 0; v < remap.length; v++) {
    const p = [0, 1, 2].map((k) => Math.round(positions[v * 3 + k] * 1e5));
    const n = [0, 1, 2].map((k) => Math.round(normals[v * 3 + k] * 1e3));
    const key = `${p}|${n}`;
    let target = unique.get(key);
    if (target === undefined) {
      target = weldedPositions.length / 3;
      unique.set(key, target);
      weldedPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      weldedNormals.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
    }
    remap[v] = target;
  }
  const welded = Uint32Array.from(indices, (v) => remap[v]);
  const [simplified] = sloppy
    ? // Ignores topology, so a perforated sheet collapses into a solid one.
      MeshoptSimplifier.simplifySloppy(welded, Float32Array.from(weldedPositions), 3, null, sloppy * 3, 1)
    : MeshoptSimplifier.simplify(welded, Float32Array.from(weldedPositions), 3, 0, error, ["ErrorAbsolute", "Prune", "Permissive"]);

  // Keep only the vertices the simplified triangles use.
  const used = new Map();
  const outPositions = [];
  const outNormals = [];
  const outIndices = new Uint32Array(simplified.length);
  for (let i = 0; i < simplified.length; i++) {
    const v = simplified[i];
    let target = used.get(v);
    if (target === undefined) {
      target = outPositions.length / 3;
      used.set(v, target);
      outPositions.push(weldedPositions[v * 3], weldedPositions[v * 3 + 1], weldedPositions[v * 3 + 2]);
      outNormals.push(weldedNormals[v * 3], weldedNormals[v * 3 + 1], weldedNormals[v * 3 + 2]);
    }
    outIndices[i] = target;
  }
  return { positions: Float32Array.from(outPositions), normals: Float32Array.from(outNormals), indices: outIndices };
}

// ---------- Colours ----------

function originalColor(config, material, name) {
  if (config.fixedColors[name]) return config.fixedColors[name];
  const [r, g, b] = material.getBaseColorFactor().slice(0, 3).map((c) => Math.round(linearToSrgb(c) * 255));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function srgbToLinear(hex) {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

// ---------- Geometry helpers ----------

function centerOf({ min, max }) {
  return min.map((v, i) => (v + max[i]) / 2);
}

function midpoint(values) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return (lo + hi) / 2;
}

/** World bounds of the node's own mesh (not its children), from every vertex. */
function meshBounds(node) {
  const matrix = node.getWorldMatrix();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = [0, 0, 0];
  for (const prim of node.getMesh().listPrimitives()) {
    const position = prim.getAttribute("POSITION");
    for (let i = 0; i < position.getCount(); i++) {
      transformPoint(matrix, position.getElement(i, p)).forEach((c, k) => {
        min[k] = Math.min(min[k], c);
        max[k] = Math.max(max[k], c);
      });
    }
  }
  return { min, max };
}

function triangleCount(node) {
  return node
    .getMesh()
    .listPrimitives()
    .reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION").getCount()) / 3, 0);
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Column-major 4x4 matrix times a point. */
function transformPoint(m, [x, y, z]) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

/** Column-major 3x3 matrix times a vector. */
function transformVector(m, [x, y, z]) {
  return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z];
}

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function determinant3(m) {
  return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
}

/** Inverse transpose of the 4x4 matrix's upper 3x3 (column-major), for transforming normals. */
function normalMatrixOf(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  // The cofactor matrix divided by the determinant is the inverse transpose.
  const s = 1 / (det || 1);
  return [
    (e * i - f * h) * s,
    (g * f - d * i) * s,
    (d * h - g * e) * s,
    (h * c - b * i) * s,
    (a * i - g * c) * s,
    (g * b - a * h) * s,
    (b * f - e * c) * s,
    (d * c - a * f) * s,
    (a * e - d * b) * s,
  ];
}
