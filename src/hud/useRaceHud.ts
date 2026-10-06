import { useEffect, useState } from "react";

import type { CarId } from "@/game/entities/Car";
import type { GameEngine } from "@/game/engine/GameEngine";
import { findRacer, RacePhase } from "@/game/state/RaceState";

/** Low-frequency race info for React UI. Updated from engine events, never per frame. */
export interface RaceHudState {
  phase: RacePhase;
  countdown: number | null;
  currentLap: number;
  laps: number;
  lastLapTicks: number | null;
  bestLapTicks: number | null;
  finishTicks: number | null;
  position: number | null;
}

function readHudState(engine: GameEngine, carId: CarId, countdown: number | null): RaceHudState {
  const { race } = engine.state;
  const racer = findRacer(race, carId);
  const position = race.finishOrder.indexOf(carId);
  return {
    phase: race.phase,
    countdown,
    currentLap: Math.min((racer?.completedLaps ?? 0) + 1, race.laps),
    laps: race.laps,
    lastLapTicks: racer?.lastLapTicks ?? null,
    bestLapTicks: racer?.bestLapTicks ?? null,
    finishTicks: racer?.finishTicks ?? null,
    position: position >= 0 ? position + 1 : null,
  };
}

export function useRaceHud(engine: GameEngine, carId: CarId): RaceHudState {
  const [hud, setHud] = useState(() => readHudState(engine, carId, null));

  useEffect(
    () =>
      engine.subscribe((event) => {
        switch (event.type) {
          case "countdown":
            setHud(readHudState(engine, carId, event.secondsLeft));
            break;
          case "phaseChanged":
          case "lapCompleted":
          case "carFinished":
            setHud(readHudState(engine, carId, null));
            break;
          case "checkpoint":
          case "impact":
            break;
        }
      }),
    [engine, carId],
  );

  return hud;
}
