export interface Vec2 {
  x: number;
  y: number;
}

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolates angles along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

/**
 * True if segment p0→p1 intersects segment a→b.
 * Scalar arguments avoid allocating vectors in the hot path.
 */
export function segmentsIntersect(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const rx = p1x - p0x;
  const ry = p1y - p0y;
  const sx = bx - ax;
  const sy = by - ay;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return false; // parallel or degenerate
  const qpx = ax - p0x;
  const qpy = ay - p0y;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Samples a closed uniform Catmull-Rom spline through `points`. */
export function sampleClosedCatmullRom(points: readonly Vec2[], samplesPerSegment: number): Vec2[] {
  const out: Vec2[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}

/** Resamples a closed polyline to (approximately) evenly spaced points. */
export function resampleClosedPolyline(points: readonly Vec2[], spacing: number): Vec2[] {
  const n = points.length;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const count = Math.max(3, Math.round(total / spacing));
  const step = total / count;

  const out: Vec2[] = [];
  let segIndex = 0;
  let segStart = 0;
  let segLength = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (segStart + segLength < target && segIndex < n - 1) {
      segStart += segLength;
      segIndex++;
      const a = points[segIndex];
      const b = points[(segIndex + 1) % n];
      segLength = Math.hypot(b.x - a.x, b.y - a.y);
    }
    const a = points[segIndex];
    const b = points[(segIndex + 1) % n];
    const t = segLength > 0 ? (target - segStart) / segLength : 0;
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return out;
}
