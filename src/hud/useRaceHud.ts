import { useEffect, useState } from "react";

import type { CarId } from "@/game/entities/Car";
import type { RaceSimulation } from "@/game/engine/RaceSimulation";
import { countdownSecondsLeft, findRacer, RacePhase } from "@/game/state/RaceState";

import { computeStandings, type Standing } from "./standings";

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
  standings: readonly Standing[];
  /** Most recent finisher other than the local player (for "X finished!" toasts). */
  lastFinisher: { carId: CarId; position: number } | null;
}

function readHudState(
  engine: RaceSimulation,
  carId: CarId,
  countdown: number | null,
  lastFinisher: RaceHudState["lastFinisher"],
): RaceHudState {
  const { race, tick } = engine.state;
  const racer = findRacer(race, carId);
  const position = race.finishOrder.indexOf(carId);
  return {
    phase: race.phase,
    // Derived as a fallback for a HUD that mounts after the countdown began (e.g. a network client).
    countdown: countdown ?? countdownSecondsLeft(race, tick),
    currentLap: Math.min((racer?.completedLaps ?? 0) + 1, race.laps),
    laps: race.laps,
    lastLapTicks: racer?.lastLapTicks ?? null,
    bestLapTicks: racer?.bestLapTicks ?? null,
    finishTicks: racer?.finishTicks ?? null,
    position: position >= 0 ? position + 1 : null,
    standings: computeStandings(race),
    lastFinisher,
  };
}

export function useRaceHud(engine: RaceSimulation, carId: CarId): RaceHudState {
  const [hud, setHud] = useState(() => readHudState(engine, carId, null, null));

  useEffect(
    () =>
      engine.subscribe((event) => {
        switch (event.type) {
          case "countdown":
            setHud((prev) => readHudState(engine, carId, event.secondsLeft, prev.lastFinisher));
            break;
          case "carFinished":
            setHud((prev) =>
              readHudState(
                engine,
                carId,
                null,
                event.carId === carId ? prev.lastFinisher : { carId: event.carId, position: event.position },
              ),
            );
            break;
          case "phaseChanged":
            // A new race (restart) clears the finisher toast.
            setHud((prev) =>
              readHudState(engine, carId, null, event.phase === RacePhase.Racing ? null : prev.lastFinisher),
            );
            break;
          case "lapCompleted":
            setHud((prev) => readHudState(engine, carId, null, prev.lastFinisher));
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
