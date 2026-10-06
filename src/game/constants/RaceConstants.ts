import { SIM_HZ } from "./PhysicsConstants";

export const MAX_PLAYERS = 8;

export const COUNTDOWN_SECONDS = 3;
export const COUNTDOWN_TICKS = COUNTDOWN_SECONDS * SIM_HZ;

/** Minimum time spent in FINISHING (celebration) before RESULTS. */
export const FINISHING_MIN_TICKS = Math.round(2.5 * SIM_HZ);
/** Multiplayer: once the leader finishes, others get this long before RESULTS. */
export const FINISHING_TIMEOUT_TICKS = 30 * SIM_HZ;

/** Starting grid layout behind the finish line. */
export const GRID = {
  distanceBehindLine: 60,
  rowSpacing: 64,
  columns: 2,
  columnSpacing: 56,
} as const;

/** Checkpoint gates extend past the track edge so a car hugging a wall still crosses. */
export const CHECKPOINT_GATE_MARGIN = 30;
