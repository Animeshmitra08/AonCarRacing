import type { Track, TrackEnvironment } from "@/game/entities/Track";
import { METERS_PER_WORLD_UNIT as S } from "@/rendering/RenderConstants";

import { TRACK_3D } from "../SceneConstants";

import type { SceneryModelId } from "./sceneryModels";

/** One placed object, in scene metres. */
export interface Placement {
  model: SceneryModelId;
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

interface SceneryKind {
  model: SceneryModelId;
  weight: number;
  minScale: number;
  maxScale: number;
}

/** A group of objects placed together (buildings, then trees around them). */
interface SceneryLayer {
  count: number;
  /** Gap between the barrier and the object's footprint, metres. */
  minEdge: number;
  maxEdge: number;
  /** Min empty space between this layer's objects and anything already placed, metres. */
  gap: number;
  /** Turn the model's front (+Z) toward the track, e.g. shop fronts. Otherwise random. */
  faceTrack: boolean;
  kinds: readonly SceneryKind[];
}

export const SCENERY_LAYOUTS: Record<TrackEnvironment, readonly SceneryLayer[]> = {
  meadow: [
    {
      count: 12,
      minEdge: 6,
      maxEdge: 40,
      gap: 4,
      faceTrack: true,
      kinds: [
        { model: "building2", weight: 3, minScale: 0.9, maxScale: 1.1 },
        { model: "building1", weight: 1, minScale: 0.9, maxScale: 1.2 },
        { model: "building3", weight: 1, minScale: 1, maxScale: 1 },
      ],
    },
    {
      count: 170,
      minEdge: 2,
      maxEdge: 45,
      gap: 1,
      faceTrack: false,
      kinds: [
        { model: "tree2", weight: 3, minScale: 0.9, maxScale: 1.4 },
        { model: "tree1", weight: 3, minScale: 1.3, maxScale: 2.2 },
        { model: "pine", weight: 1, minScale: 0.8, maxScale: 1.1 },
      ],
    },
  ],
  desert: [
    {
      count: 24,
      minEdge: 5,
      maxEdge: 50,
      gap: 3,
      faceTrack: true,
      kinds: [
        { model: "building3", weight: 2, minScale: 1, maxScale: 1.1 },
        { model: "building2", weight: 2, minScale: 0.9, maxScale: 1.1 },
        { model: "building1", weight: 1, minScale: 1, maxScale: 1.3 },
      ],
    },
    {
      count: 40,
      minEdge: 3,
      maxEdge: 50,
      gap: 1,
      faceTrack: false,
      kinds: [
        { model: "tree1", weight: 2, minScale: 1.2, maxScale: 1.8 },
        { model: "tree2", weight: 1, minScale: 0.9, maxScale: 1.2 },
      ],
    },
  ],
  snow: [
    {
      count: 6,
      minEdge: 10,
      maxEdge: 45,
      gap: 6,
      faceTrack: true,
      kinds: [
        { model: "building1", weight: 1, minScale: 0.9, maxScale: 1.1 },
        { model: "building2", weight: 1, minScale: 0.9, maxScale: 1 },
      ],
    },
    {
      count: 230,
      minEdge: 2,
      maxEdge: 50,
      gap: 0.8,
      faceTrack: false,
      kinds: [
        { model: "pine", weight: 6, minScale: 0.8, maxScale: 1.3 },
        { model: "tree1", weight: 1, minScale: 1.2, maxScale: 1.6 },
      ],
    },
  ],
};

const ATTEMPTS_PER_OBJECT = 25;
/** Extra clearance between any object and the outside of the barriers, metres. */
const TRACK_MARGIN = 1.5;

/**
 * Deterministic placement (seeded by track id), so every phone in a multiplayer race
 * sees the same world. Objects never touch the road, the barriers or each other.
 *
 * `density` 0..1 keeps that fraction of each layer. Lower densities are a strict subset
 * of higher ones, so graphics settings never move anything, only thin it out.
 */
export function layoutScenery(
  track: Track,
  footprints: Partial<Record<SceneryModelId, number>>,
  density: number,
): Placement[] {
  const random = mulberry32(hashString(track.definition.id));
  const centerline = track.centerline.map((p) => ({ x: p.x * S, z: p.y * S }));
  const normals = track.tangents.map((t) => ({ x: -t.y, z: t.x }));
  const roadHalfWidth = track.halfWidth * S + TRACK_3D.barrierThickness + TRACK_MARGIN;
  const placed: (Placement & { radius: number })[] = [];
  const result: Placement[] = [];

  for (const layer of SCENERY_LAYOUTS[track.definition.environment]) {
    const kinds = layer.kinds.filter((kind) => footprints[kind.model] !== undefined);
    if (kinds.length === 0) continue;
    const totalWeight = kinds.reduce((sum, kind) => sum + kind.weight, 0);
    const layerPlacements: Placement[] = [];

    for (let attempt = 0; attempt < layer.count * ATTEMPTS_PER_OBJECT && layerPlacements.length < layer.count; attempt++) {
      const kind = pickWeighted(kinds, totalWeight, random());
      const scale = kind.minScale + random() * (kind.maxScale - kind.minScale);
      const radius = footprints[kind.model]! * scale;
      const i = Math.floor(random() * centerline.length);
      const side = random() < 0.5 ? -1 : 1;
      const offset = (roadHalfWidth + radius + layer.minEdge + random() * (layer.maxEdge - layer.minEdge)) * side;
      const x = centerline[i].x + normals[i].x * offset;
      const z = centerline[i].z + normals[i].z * offset;
      const yawRandom = random() * Math.PI * 2;

      // Clear of every part of the track (other straights/infields, not just the nearest)…
      let nearest = 0;
      let nearestSq = Infinity;
      for (let k = 0; k < centerline.length; k++) {
        const dSq = (centerline[k].x - x) ** 2 + (centerline[k].z - z) ** 2;
        if (dSq < nearestSq) {
          nearestSq = dSq;
          nearest = k;
        }
      }
      if (Math.sqrt(nearestSq) < roadHalfWidth + radius) continue;
      // …and of everything already placed.
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + layer.gap)) continue;

      // Rotating by yaw about +Y turns +Z toward (sin yaw, cos yaw).
      const yaw = layer.faceTrack ? Math.atan2(centerline[nearest].x - x, centerline[nearest].z - z) : yawRandom;
      const placement = { model: kind.model, x, z, yaw, scale };
      placed.push({ ...placement, radius });
      layerPlacements.push(placement);
    }
    result.push(...layerPlacements.slice(0, Math.round(layerPlacements.length * Math.min(1, Math.max(0, density)))));
  }
  return result;
}

function pickWeighted(kinds: readonly SceneryKind[], totalWeight: number, roll: number): SceneryKind {
  let threshold = roll * totalWeight;
  for (const kind of kinds) {
    threshold -= kind.weight;
    if (threshold < 0) return kind;
  }
  return kinds[kinds.length - 1];
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Small seeded PRNG so scenery is identical on every device (and every peer). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
