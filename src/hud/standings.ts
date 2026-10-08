import type { CarId } from "@/game/entities/Car";
import type { RaceState, RacerProgress } from "@/game/state/RaceState";

export interface Standing {
  carId: CarId;
  /** 1-based. Finishers by crossing order, then everyone else by progress. */
  position: number;
  finished: boolean;
  totalTicks: number | null;
  /** Behind the winner, ticks; null for the winner and non-finishers. */
  gapTicks: number | null;
  bestLapTicks: number | null;
  lapTimes: readonly number[];
  completedLaps: number;
}

/** Progress through the current lap: higher = further round (gate 0 = finish line, so it counts as last). */
function lapProgress(race: RaceState, racer: RacerProgress): number {
  return racer.nextCheckpoint === 0 ? race.checkpointCount : racer.nextCheckpoint;
}

export function computeStandings(race: RaceState): Standing[] {
  const finished = race.finishOrder
    .map((id) => race.racers.find((r) => r.carId === id))
    .filter((r): r is RacerProgress => r !== undefined);
  const running = race.racers
    .filter((r) => r.finishTicks === null)
    .sort((a, b) => b.completedLaps - a.completedLaps || lapProgress(race, b) - lapProgress(race, a));
  const winnerTicks = finished[0]?.finishTicks ?? null;

  return [...finished, ...running].map((racer, index) => ({
    carId: racer.carId,
    position: index + 1,
    finished: racer.finishTicks !== null,
    totalTicks: racer.finishTicks,
    gapTicks:
      index > 0 && racer.finishTicks !== null && winnerTicks !== null ? racer.finishTicks - winnerTicks : null,
    bestLapTicks: racer.bestLapTicks,
    lapTimes: racer.lapTimes,
    completedLaps: racer.completedLaps,
  }));
}

export function ordinal(position: number): string {
  const tens = position % 100;
  if (tens >= 11 && tens <= 13) return `${position}TH`;
  return `${position}${["TH", "ST", "ND", "RD"][position % 10] ?? "TH"}`;
}
