import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type ColorRepresentation,
} from "three";

import type { Track } from "@/game/entities/Track";
import type { Vec2 } from "@/game/math/geometry";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

import { SCENE, SCENERY, TRACK_3D, type EnvironmentPalette } from "./SceneConstants";

/**
 * Builds the static 3D track from the same `Track` geometry physics uses,
 * so walls you see are exactly where walls collide.
 */
export function createTrackModel(track: Track, palette: EnvironmentPalette): Group {
  const group = new Group();
  group.add(
    createGround(track, palette),
    createRoadSurface(track),
    createBarriers(track),
    createFinishGantry(track),
    createTrees(track, palette),
  );
  return group;
}

/** Accumulates flat-shaded, vertex-coloured quads into one mesh (one draw call). */
class QuadBuilder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];

  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color): void {
    for (const v of [a, b, c, a, c, d]) {
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  build(): Mesh {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    // DoubleSide: correct lighting regardless of winding.
    return new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));
  }
}

/** World (x, y) → scene (x, height, z) in metres. */
function toScene(p: Vec2, height: number, offsetX = 0, offsetZ = 0): Vector3 {
  return new Vector3(p.x * S + offsetX, height, p.y * S + offsetZ);
}

function createGround(track: Track, palette: EnvironmentPalette): Mesh {
  const { bounds } = track;
  const geometry = new PlaneGeometry(SCENE.groundSize, SCENE.groundSize).rotateX(-Math.PI / 2);
  const ground = new Mesh(geometry, new MeshLambertMaterial({ color: palette.ground }));
  ground.position.set(((bounds.minX + bounds.maxX) / 2) * S, 0, ((bounds.minY + bounds.maxY) / 2) * S);
  return ground;
}

/** Asphalt, kerbs, centre-line dashes and the chequered finish line in one mesh. */
function createRoadSurface(track: Track): Mesh {
  const builder = new QuadBuilder();
  const { centerline, tangents, leftEdge, rightEdge } = track;
  const n = centerline.length;
  const asphalt = new Color(TRACK_3D.asphalt);
  const kerbColors = [new Color(TRACK_3D.kerbRed), new Color(TRACK_3D.kerbWhite)];
  const laneMark = new Color(TRACK_3D.laneMark);
  const kerb = TRACK_3D.kerbWidth;
  const mark = TRACK_3D.laneMarkWidth / 2;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Right-hand normals (scene metres) at both ends of the segment.
    const rix = -tangents[i].y;
    const riz = tangents[i].x;
    const rjx = -tangents[j].y;
    const rjz = tangents[j].x;

    builder.quad(
      toScene(leftEdge[i], TRACK_3D.roadY),
      toScene(rightEdge[i], TRACK_3D.roadY),
      toScene(rightEdge[j], TRACK_3D.roadY),
      toScene(leftEdge[j], TRACK_3D.roadY),
      asphalt,
    );

    const kerbColor = kerbColors[i % 2];
    builder.quad(
      toScene(leftEdge[i], TRACK_3D.kerbY),
      toScene(leftEdge[i], TRACK_3D.kerbY, rix * kerb, riz * kerb),
      toScene(leftEdge[j], TRACK_3D.kerbY, rjx * kerb, rjz * kerb),
      toScene(leftEdge[j], TRACK_3D.kerbY),
      kerbColor,
    );
    builder.quad(
      toScene(rightEdge[i], TRACK_3D.kerbY),
      toScene(rightEdge[i], TRACK_3D.kerbY, -rix * kerb, -riz * kerb),
      toScene(rightEdge[j], TRACK_3D.kerbY, -rjx * kerb, -rjz * kerb),
      toScene(rightEdge[j], TRACK_3D.kerbY),
      kerbColor,
    );

    if (i % 2 === 0) {
      builder.quad(
        toScene(centerline[i], TRACK_3D.markY, -rix * mark, -riz * mark),
        toScene(centerline[i], TRACK_3D.markY, rix * mark, riz * mark),
        toScene(centerline[j], TRACK_3D.markY, rjx * mark, rjz * mark),
        toScene(centerline[j], TRACK_3D.markY, -rjx * mark, -rjz * mark),
        laneMark,
      );
    }
  }

  addFinishLine(builder, track);
  return builder.build();
}

function addFinishLine(builder: QuadBuilder, track: Track): void {
  const finish = track.checkpoints[0];
  const center = { x: (finish.ax + finish.bx) / 2, y: (finish.ay + finish.by) / 2 };
  const size = TRACK_3D.finishSquare;
  const columns = Math.floor((track.halfWidth * 2 * S) / size);
  const startU = -(columns * size) / 2;
  const colors = [new Color(TRACK_3D.finishDark), new Color(TRACK_3D.finishLight)];
  // u runs across the road (right normal), v along the racing direction.
  const rx = -finish.dirY;
  const rz = finish.dirX;
  const at = (u: number, v: number) => toScene(center, TRACK_3D.markY, rx * u + finish.dirX * v, rz * u + finish.dirY * v);

  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < 2; row++) {
      const u0 = startU + col * size;
      const v0 = (row - 1) * size;
      builder.quad(at(u0, v0), at(u0 + size, v0), at(u0 + size, v0 + size), at(u0, v0 + size), colors[(col + row) % 2]);
    }
  }
}

/** Low walls whose inner face sits exactly on the physics wall's inner face. */
function createBarriers(track: Track): Mesh {
  const builder = new QuadBuilder();
  const panelColors = [new Color(TRACK_3D.barrierA), new Color(TRACK_3D.barrierB)];
  const h = TRACK_3D.barrierHeight;
  const t = TRACK_3D.barrierThickness;

  const addEdge = (edge: readonly Vec2[], side: -1 | 1) => {
    const n = edge.length;
    for (let i = 0; i < n; i++) {
      const a = edge[i];
      const b = edge[(i + 1) % n];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length === 0) continue;
      // Outward normal (unit), matching PhysicsEngine's wall placement.
      const ox = ((-(b.y - a.y)) / length) * side * t;
      const oz = ((b.x - a.x) / length) * side * t;
      const color = panelColors[Math.floor(i / TRACK_3D.barrierPanelSegments) % 2];

      const a0 = toScene(a, 0);
      const b0 = toScene(b, 0);
      const aTop = toScene(a, h);
      const bTop = toScene(b, h);
      const aTopOut = toScene(a, h, ox, oz);
      const bTopOut = toScene(b, h, ox, oz);
      builder.quad(a0, b0, bTop, aTop, color);
      builder.quad(aTop, bTop, bTopOut, aTopOut, color);
      builder.quad(toScene(a, 0, ox, oz), toScene(b, 0, ox, oz), bTopOut, aTopOut, color);
    }
  };

  addEdge(track.leftEdge, -1);
  addEdge(track.rightEdge, 1);
  return builder.build();
}

function createFinishGantry(track: Track): Group {
  const finish = track.checkpoints[0];
  const center = { x: (finish.ax + finish.bx) / 2, y: (finish.ay + finish.by) / 2 };
  const rx = -finish.dirY;
  const rz = finish.dirX;
  const halfSpan = track.halfWidth * S + TRACK_3D.gantryOverhang;
  const { gantryHeight, gantryPostSize, gantryBeamHeight, gantryBeamDepth } = TRACK_3D;

  const gantry = new Group();
  const postMaterial = new MeshLambertMaterial({ color: TRACK_3D.gantryPost });
  const postGeometry = new BoxGeometry(gantryPostSize, gantryHeight, gantryPostSize);
  for (const side of [-1, 1]) {
    const post = new Mesh(postGeometry, postMaterial);
    post.position.copy(toScene(center, gantryHeight / 2, rx * halfSpan * side, rz * halfSpan * side));
    gantry.add(post);
  }

  const beam = new Mesh(
    new BoxGeometry(halfSpan * 2, gantryBeamHeight, gantryBeamDepth),
    new MeshLambertMaterial({ color: TRACK_3D.gantryBanner }),
  );
  beam.position.copy(toScene(center, gantryHeight - gantryBeamHeight / 2));
  // Box length runs along local x; align it with the road's right normal.
  beam.rotation.y = -Math.atan2(rz, rx);
  gantry.add(beam);
  return gantry;
}

/** Deterministic tree scatter outside the barriers, as two instanced draw calls. */
function createTrees(track: Track, palette: EnvironmentPalette): Group {
  const random = mulberry32(SCENERY.seed);
  const { centerline, tangents, halfWidth } = track;
  const n = centerline.length;
  const minClearance = halfWidth + SCENERY.minEdgeDistance / S;
  const minClearanceSq = minClearance * minClearance;

  const positions: Vec2[] = [];
  for (let attempt = 0; attempt < SCENERY.maxPlacementAttempts && positions.length < SCENERY.treeCount; attempt++) {
    const i = Math.floor(random() * n);
    const side = random() < 0.5 ? -1 : 1;
    const edgeDistance = SCENERY.minEdgeDistance + random() * (SCENERY.maxEdgeDistance - SCENERY.minEdgeDistance);
    const offset = (halfWidth + edgeDistance / S) * side;
    const candidate = {
      x: centerline[i].x - tangents[i].y * offset,
      y: centerline[i].y + tangents[i].x * offset,
    };
    // Reject spots that are near any other part of the track (e.g. inside tight infields).
    const clear = centerline.every((p) => (p.x - candidate.x) ** 2 + (p.y - candidate.y) ** 2 >= minClearanceSq);
    if (clear) positions.push(candidate);
  }

  const trunkGeometry = new CylinderGeometry(SCENERY.trunkRadius, SCENERY.trunkRadius, SCENERY.trunkHeight, 6).translate(
    0,
    SCENERY.trunkHeight / 2,
    0,
  );
  const foliageGeometry = new ConeGeometry(SCENERY.foliageRadius, SCENERY.foliageHeight, 7).translate(
    0,
    SCENERY.trunkHeight + SCENERY.foliageHeight / 2,
    0,
  );
  const trunks = createInstanced(trunkGeometry, palette.trunk, positions.length);
  const foliage = createInstanced(foliageGeometry, palette.foliage, positions.length);

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const scale = new Vector3();
  positions.forEach((p, index) => {
    const s = SCENERY.minScale + random() * (SCENERY.maxScale - SCENERY.minScale);
    matrix.compose(toScene(p, 0), rotation, scale.set(s, s, s));
    trunks.setMatrixAt(index, matrix);
    foliage.setMatrixAt(index, matrix);
  });

  const group = new Group();
  group.add(trunks, foliage);
  return group;
}

function createInstanced(geometry: BufferGeometry, color: ColorRepresentation, count: number): InstancedMesh {
  const mesh = new InstancedMesh(geometry, new MeshLambertMaterial({ color }), count);
  // Instances surround the whole track; per-instance culling isn't worth it here.
  mesh.frustumCulled = false;
  return mesh;
}

/** Small seeded PRNG so scenery is identical on every device (and every peer). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
