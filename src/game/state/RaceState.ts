import { SIM_HZ } from "@/game/constants/PhysicsConstants";
import { COUNTDOWN_TICKS } from "@/game/constants/RaceConstants";
import type { CarId } from "@/game/entities/Car";

export const RacePhase = {
  Lobby: "LOBBY",
  Countdown: "COUNTDOWN",
  Racing: "RACING",
  Finishing: "FINISHING",
  Results: "RESULTS",
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- enum-like const/type pair
export type RacePhase = (typeof RacePhase)[keyof typeof RacePhase];

/** Per-car race progress. All times are simulation ticks (deterministic, network-friendly). */
export interface RacerProgress {
  readonly carId: CarId;
  completedLaps: number;
  nextCheckpoint: number;
  lapStartTick: number;
  lastLapTicks: number | null;
  bestLapTicks: number | null;
  /** Ticks from race start to crossing the line on the final lap. */
  finishTicks: number | null;
}

export interface RaceState {
  phase: RacePhase;
  phaseStartTick: number;
  raceStartTick: number;
  readonly laps: number;
  readonly checkpointCount: number;
  readonly racers: RacerProgress[];
  readonly finishOrder: CarId[];
}

export function createRaceState(carIds: readonly CarId[], laps: number, checkpointCount: number): RaceState {
  return {
    phase: RacePhase.Lobby,
    phaseStartTick: 0,
    raceStartTick: 0,
    laps,
    checkpointCount,
    racers: carIds.map((carId) => createRacerProgress(carId, checkpointCount)),
    finishOrder: [],
  };
}

export function resetRacerProgress(racer: RacerProgress, startTick: number, checkpointCount: number): void {
  racer.completedLaps = 0;
  // The grid sits behind the finish line, so the first gate to hit is #1.
  racer.nextCheckpoint = checkpointCount > 1 ? 1 : 0;
  racer.lapStartTick = startTick;
  racer.lastLapTicks = null;
  racer.bestLapTicks = null;
  racer.finishTicks = null;
}

function createRacerProgress(carId: CarId, checkpointCount: number): RacerProgress {
  const racer: RacerProgress = {
    carId,
    completedLaps: 0,
    nextCheckpoint: 0,
    lapStartTick: 0,
    lastLapTicks: null,
    bestLapTicks: null,
    finishTicks: null,
  };
  resetRacerProgress(racer, 0, checkpointCount);
  return racer;
}

export function findRacer(race: RaceState, carId: CarId): RacerProgress | undefined {
  return race.racers.find((r) => r.carId === carId);
}

/** Whole seconds left in the countdown (for UI that mounts mid-countdown), or null. */
export function countdownSecondsLeft(race: RaceState, tick: number): number | null {
  if (race.phase !== RacePhase.Countdown) return null;
  const secondsLeft = Math.ceil((COUNTDOWN_TICKS - (tick - race.phaseStartTick)) / SIM_HZ);
  return secondsLeft > 0 ? secondsLeft : null;
}

/** Whether a racer's driver input should reach their car this tick. */
export function canRacerDrive(race: RaceState, racer: RacerProgress): boolean {
  return (race.phase === RacePhase.Racing || race.phase === RacePhase.Finishing) && racer.finishTicks === null;
}

/** Elapsed race ticks for a racer: frozen once they finish, 0 before the start. */
export function racerElapsedTicks(race: RaceState, racer: RacerProgress, tick: number): number {
  if (racer.finishTicks !== null) return racer.finishTicks;
  if (race.phase === RacePhase.Lobby || race.phase === RacePhase.Countdown) return 0;
  return tick - race.raceStartTick;
}
