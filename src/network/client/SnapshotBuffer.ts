import { lerp, lerpAngle, type Pose } from "@/game/math/geometry";
import { SNAPSHOT_BUFFER_SIZE } from "@/network/constants";
import { CAR_STATE_STRIDE, CS_ANGLE, CS_X, CS_Y } from "@/network/protocol";

interface Entry {
  tick: number;
  cars: number[];
}

/** Recent host snapshots, for drawing remote cars slightly in the past between two known states. */
export class SnapshotBuffer {
  private readonly entries: Entry[] = [];

  get latest(): Entry | null {
    return this.entries.length > 0 ? this.entries[this.entries.length - 1] : null;
  }

  push(tick: number, cars: number[]): void {
    const latest = this.latest;
    if (latest && tick <= latest.tick) return;
    this.entries.push({ tick, cars });
    if (this.entries.length > SNAPSHOT_BUFFER_SIZE) this.entries.shift();
  }

  clear(): void {
    this.entries.length = 0;
  }

  /**
   * Interpolates car `index` at a (fractional) host tick. Clamps to the oldest/newest
   * snapshot rather than extrapolating. Returns false when there is no data yet.
   */
  sample(tick: number, index: number, out: Pose): boolean {
    const { entries } = this;
    if (entries.length === 0) return false;

    let i = entries.length - 1;
    while (i > 0 && entries[i].tick > tick) i--;
    const a = entries[i];
    const b = entries[Math.min(i + 1, entries.length - 1)];
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.min(1, Math.max(0, (tick - a.tick) / span)) : 0;

    const base = index * CAR_STATE_STRIDE;
    out.x = lerp(a.cars[base + CS_X], b.cars[base + CS_X], t);
    out.y = lerp(a.cars[base + CS_Y], b.cars[base + CS_Y], t);
    out.angle = lerpAngle(a.cars[base + CS_ANGLE], b.cars[base + CS_ANGLE], t);
    return true;
  }
}
