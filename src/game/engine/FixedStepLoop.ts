import { FIXED_DT_MS, MAX_FRAME_MS, MAX_STEPS_PER_FRAME } from "@/game/constants/PhysicsConstants";

/**
 * requestAnimationFrame-driven fixed-timestep loop: runs `onStep` at SIM_HZ
 * regardless of display rate, then `onFrame` once per display frame with the
 * interpolation factor between the last two steps.
 */
export class FixedStepLoop {
  private rafId: number | null = null;
  private lastFrameTime = -1;
  private accumulator = 0;

  constructor(
    private readonly onStep: () => void,
    private readonly onFrame: (alpha: number, frameDt: number) => void,
  ) {}

  get running(): boolean {
    return this.rafId !== null;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameTime = -1;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);

    const frameMs = this.lastFrameTime < 0 ? FIXED_DT_MS : Math.min(now - this.lastFrameTime, MAX_FRAME_MS);
    this.lastFrameTime = now;
    this.accumulator += frameMs;

    let steps = 0;
    while (this.accumulator >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
      this.onStep();
      this.accumulator -= FIXED_DT_MS;
      steps++;
    }
    // Couldn't catch up: drop the backlog rather than spiral.
    if (this.accumulator >= FIXED_DT_MS) this.accumulator = 0;

    this.onFrame(this.accumulator / FIXED_DT_MS, frameMs / 1000);
  };
}
