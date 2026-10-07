import type { Pose } from "@/game/math/geometry";
import type { GameEventListener } from "@/game/state/GameEvents";
import type { GameState } from "@/game/state/GameState";

/** Called once per display frame after simulation; `alpha` is 0..1 between the last two ticks. */
export type FrameListener = (state: GameState, alpha: number, frameDt: number) => void;

/**
 * What rendering and the HUD need from a race, whoever runs it: the local
 * authoritative `GameEngine` (single-player / host) or a network client's
 * predicted + interpolated replica.
 */
export interface RaceSimulation {
  readonly state: GameState;
  setFrameListener(listener: FrameListener | null): void;
  subscribe(listener: GameEventListener): () => void;
  /** Fills `out[i]` with the pose to draw `state.cars[i]` at this frame. */
  writeRenderPoses(alpha: number, out: Pose[]): void;
}
