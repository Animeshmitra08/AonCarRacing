import type { CarId } from "@/game/entities/Car";

import type { RacePhase } from "./RaceState";

/**
 * Discrete, low-frequency happenings. UI subscribes to these instead of polling
 * state; later the host can broadcast the same events to clients.
 */
export type GameEvent =
  | { type: "phaseChanged"; phase: RacePhase; tick: number }
  | { type: "countdown"; secondsLeft: number }
  | { type: "checkpoint"; carId: CarId; index: number }
  | { type: "lapCompleted"; carId: CarId; completedLaps: number; lapTicks: number }
  | { type: "carFinished"; carId: CarId; position: number; totalTicks: number }
  | { type: "impact"; carId: CarId; impactSpeed: number };

export type GameEventListener = (event: GameEvent) => void;
