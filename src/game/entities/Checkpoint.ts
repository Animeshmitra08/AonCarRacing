import { segmentsIntersect, type Vec2 } from "@/game/math/geometry";

/**
 * A gate across the track. Index 0 is always the finish line.
 * Crossing is detected geometrically (not with Matter sensors) so fast cars
 * can't tunnel through it and direction can be validated.
 */
export interface Checkpoint {
  readonly index: number;
  readonly isFinishLine: boolean;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  /** Unit vector of the racing direction through the gate. */
  readonly dirX: number;
  readonly dirY: number;
}

export function createCheckpoint(index: number, center: Vec2, tangent: Vec2, halfLength: number): Checkpoint {
  // Right-hand normal in a y-down coordinate system.
  const nx = -tangent.y;
  const ny = tangent.x;
  return {
    index,
    isFinishLine: index === 0,
    ax: center.x - nx * halfLength,
    ay: center.y - ny * halfLength,
    bx: center.x + nx * halfLength,
    by: center.y + ny * halfLength,
    dirX: tangent.x,
    dirY: tangent.y,
  };
}

/** True if moving from (x0,y0) to (x1,y1) crosses the gate in the racing direction. */
export function crossesCheckpoint(cp: Checkpoint, x0: number, y0: number, x1: number, y1: number): boolean {
  const forward = (x1 - x0) * cp.dirX + (y1 - y0) * cp.dirY;
  if (forward <= 0) return false;
  return segmentsIntersect(x0, y0, x1, y1, cp.ax, cp.ay, cp.bx, cp.by);
}
