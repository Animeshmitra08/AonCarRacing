import { CHECKPOINT_GATE_MARGIN, GRID, MAX_PLAYERS } from "@/game/constants/RaceConstants";
import {
  resampleClosedPolyline,
  sampleClosedCatmullRom,
  type Pose,
  type Vec2,
} from "@/game/math/geometry";

import { createCheckpoint, type Checkpoint } from "./Checkpoint";

/** Visual setting; renderers map it to their own palette/scenery. */
export type TrackEnvironment = "meadow" | "desert" | "snow";

/** Authoring format: small, serializable, no derived data. */
export interface TrackDefinition {
  readonly id: string;
  readonly name: string;
  readonly environment: TrackEnvironment;
  /** Default lap count; a race config may override it. */
  readonly laps: number;
  readonly width: number;
  /** Closed loop, in driving order. The first point is the finish line. */
  readonly controlPoints: readonly Vec2[];
  /** Lap fractions (0..1) for each checkpoint. Must start with 0 (finish line). */
  readonly checkpoints: readonly number[];
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Derived geometry shared by physics, race logic and rendering. Built once. */
export interface Track {
  readonly definition: TrackDefinition;
  readonly laps: number;
  readonly halfWidth: number;
  /** Evenly spaced centerline samples (closed loop). */
  readonly centerline: readonly Vec2[];
  /** Unit tangents per centerline sample. */
  readonly tangents: readonly Vec2[];
  /** Distance along the lap at each centerline sample. */
  readonly distances: readonly number[];
  readonly length: number;
  readonly leftEdge: readonly Vec2[];
  readonly rightEdge: readonly Vec2[];
  readonly checkpoints: readonly Checkpoint[];
  readonly startGrid: readonly Pose[];
  readonly bounds: Bounds;
}

const SPLINE_SAMPLES_PER_SEGMENT = 24;
const CENTERLINE_SPACING = 40;

export function buildTrack(definition: TrackDefinition): Track {
  if (definition.checkpoints[0] !== 0) {
    throw new Error(`Track "${definition.id}": first checkpoint must be at 0 (finish line).`);
  }

  const dense = sampleClosedCatmullRom(definition.controlPoints, SPLINE_SAMPLES_PER_SEGMENT);
  const centerline = resampleClosedPolyline(dense, CENTERLINE_SPACING);
  const n = centerline.length;
  const halfWidth = definition.width / 2;

  const tangents: Vec2[] = [];
  const leftEdge: Vec2[] = [];
  const rightEdge: Vec2[] = [];
  const distances: number[] = [];
  let length = 0;

  for (let i = 0; i < n; i++) {
    const prev = centerline[(i - 1 + n) % n];
    const next = centerline[(i + 1) % n];
    const p = centerline[i];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = { x: dx / len, y: dy / len };
    tangents.push(t);
    // Right-hand normal in a y-down coordinate system.
    const nx = -t.y;
    const ny = t.x;
    leftEdge.push({ x: p.x - nx * halfWidth, y: p.y - ny * halfWidth });
    rightEdge.push({ x: p.x + nx * halfWidth, y: p.y + ny * halfWidth });

    distances.push(length);
    length += Math.hypot(next.x - p.x, next.y - p.y);
  }

  const track: Omit<Track, "checkpoints" | "startGrid"> = {
    definition,
    laps: definition.laps,
    halfWidth,
    centerline,
    tangents,
    distances,
    length,
    leftEdge,
    rightEdge,
    bounds: computeBounds(leftEdge, rightEdge),
  };

  const checkpoints = definition.checkpoints.map((fraction, index) => {
    const at = sampleAtDistance(track, fraction * length);
    return createCheckpoint(index, at.position, at.tangent, halfWidth + CHECKPOINT_GATE_MARGIN);
  });

  return { ...track, checkpoints, startGrid: buildStartGrid(track) };
}

interface TrackSample {
  position: Vec2;
  tangent: Vec2;
}

/** Position/tangent at a lap distance (wraps; negative = behind the finish line). */
export function sampleAtDistance(
  track: Pick<Track, "centerline" | "tangents" | "distances" | "length">,
  distance: number,
): TrackSample {
  const { centerline, tangents, distances, length } = track;
  const n = centerline.length;
  const d = ((distance % length) + length) % length;

  // Linear scan is fine: only called while building the track.
  let i = 0;
  while (i < n - 1 && distances[i + 1] <= d) i++;
  const j = (i + 1) % n;
  const segEnd = j === 0 ? length : distances[j];
  const t = (d - distances[i]) / (segEnd - distances[i] || 1);

  const a = centerline[i];
  const b = centerline[j];
  const ta = tangents[i];
  const tb = tangents[j];
  const tx = ta.x + (tb.x - ta.x) * t;
  const ty = ta.y + (tb.y - ta.y) * t;
  const tl = Math.hypot(tx, ty) || 1;
  return {
    position: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
    tangent: { x: tx / tl, y: ty / tl },
  };
}

/** Staggered two-wide grid, walked backwards along the centerline from the finish line. */
function buildStartGrid(track: Omit<Track, "checkpoints" | "startGrid">): Pose[] {
  const grid: Pose[] = [];
  for (let slot = 0; slot < MAX_PLAYERS; slot++) {
    const row = Math.floor(slot / GRID.columns);
    const column = slot % GRID.columns;
    const stagger = column * (GRID.rowSpacing / 2);
    const back = GRID.distanceBehindLine + row * GRID.rowSpacing + stagger;
    const { position, tangent } = sampleAtDistance(track, -back);
    const lateral = (column - (GRID.columns - 1) / 2) * GRID.columnSpacing;
    grid.push({
      x: position.x - tangent.y * lateral,
      y: position.y + tangent.x * lateral,
      angle: Math.atan2(tangent.y, tangent.x),
    });
  }
  return grid;
}

function computeBounds(...polylines: (readonly Vec2[])[]): Bounds {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const line of polylines) {
    for (const p of line) {
      if (p.x < bounds.minX) bounds.minX = p.x;
      if (p.y < bounds.minY) bounds.minY = p.y;
      if (p.x > bounds.maxX) bounds.maxX = p.x;
      if (p.y > bounds.maxY) bounds.maxY = p.y;
    }
  }
  return bounds;
}
