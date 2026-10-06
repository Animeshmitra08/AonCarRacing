import type { Pose } from "@/game/math/geometry";
import type { GameState } from "@/game/state/GameState";

/** Anything that can draw the game world from interpolated simulation state. */
export interface WorldView {
  /** `poses[i]` is the interpolated pose of `state.cars[i]`; `dt` is the frame time in seconds. */
  render(state: GameState, poses: readonly Pose[], followIndex: number, dt: number): void;
  /** `strength` 0..1 */
  addShake(strength: number): void;
  dispose(): void;
}
