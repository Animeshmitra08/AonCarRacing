import type { Track } from "@/game/entities/Track";

export const WRONG_WAY = {
  /** Nose this far from the racing direction (cosine) counts as wrong way. */
  facingThreshold: -0.35,
  /** Reversing faster than this (px/s) is a manoeuvre, not wrong way. */
  reversingSpeed: 40,
  /** Seconds facing the wrong way before warning (ignores brief spins). */
  showAfter: 0.7,
  /** Seconds facing the right way again before the warning clears. */
  hideAfter: 0.35,
} as const;

/**
 * Tracks whether a car is heading against the track direction, with hysteresis
 * so a quick spin or wall bounce doesn't flash the warning.
 */
export class WrongWayDetector {
  private wrongSeconds = 0;
  private rightSeconds = 0;
  private active = false;

  constructor(private readonly track: Track) {}

  /** `angle` radians, `forwardSpeed` px/s (negative when reversing), `dt` seconds. */
  update(x: number, y: number, angle: number, forwardSpeed: number, dt: number): boolean {
    const tangent = this.track.tangents[this.nearestIndex(x, y)];
    const facing = Math.cos(angle) * tangent.x + Math.sin(angle) * tangent.y;
    const reversing = forwardSpeed < -WRONG_WAY.reversingSpeed;

    if (facing < WRONG_WAY.facingThreshold && !reversing) {
      this.wrongSeconds += dt;
      this.rightSeconds = 0;
      if (this.wrongSeconds >= WRONG_WAY.showAfter) this.active = true;
    } else {
      this.rightSeconds += dt;
      this.wrongSeconds = 0;
      if (this.rightSeconds >= WRONG_WAY.hideAfter) this.active = false;
    }
    return this.active;
  }

  reset(): void {
    this.wrongSeconds = 0;
    this.rightSeconds = 0;
    this.active = false;
  }

  private nearestIndex(x: number, y: number): number {
    const { centerline } = this.track;
    let best = 0;
    let bestSq = Infinity;
    for (let i = 0; i < centerline.length; i++) {
      const dSq = (centerline[i].x - x) ** 2 + (centerline[i].y - y) ** 2;
      if (dSq < bestSq) {
        bestSq = dSq;
        best = i;
      }
    }
    return best;
  }
}
