import type { Car } from "@/game/entities/Car";
import type { Track } from "@/game/entities/Track";

import type { RaceState } from "./RaceState";

/**
 * The authoritative simulation state. Mutated in place every tick; never put
 * this (or anything derived per-frame from it) into React state.
 */
export interface GameState {
  tick: number;
  readonly track: Track;
  readonly cars: readonly Car[];
  readonly race: RaceState;
}
