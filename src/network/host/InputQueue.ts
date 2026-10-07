import { createNeutralInput, type CarInput } from "@/game/state/CarInput";
import { MAX_QUEUED_INPUTS } from "@/network/constants";
import { frameToInput, type InputFrame } from "@/network/protocol";

/**
 * One client's inputs, consumed one per host tick. `lastProcessedSeq` is sent
 * back in snapshots so the client knows which predicted inputs to replay.
 */
export class InputQueue {
  lastProcessedSeq = 0;
  private lastReceivedSeq = 0;
  private readonly frames: InputFrame[] = [];
  private readonly current = createNeutralInput();

  push(frames: readonly InputFrame[]): void {
    for (const frame of frames) {
      if (frame[0] <= this.lastReceivedSeq) continue; // duplicate or out of date
      this.lastReceivedSeq = frame[0];
      this.frames.push(frame);
    }
    // A client running ahead (or a burst after a stall) must not add latency.
    if (this.frames.length > MAX_QUEUED_INPUTS) this.frames.splice(0, this.frames.length - MAX_QUEUED_INPUTS);
  }

  /** The input for this tick, or `null` if nothing arrived (keep the previous input). */
  next(): Readonly<CarInput> | null {
    const frame = this.frames.shift();
    if (!frame) return null;
    this.lastProcessedSeq = frame[0];
    return frameToInput(frame, this.current);
  }
}
