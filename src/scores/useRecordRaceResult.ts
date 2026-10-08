import { useEffect, useEffectEvent, useState } from "react";

import type { CarId } from "@/game/entities/Car";
import type { RaceSimulation } from "@/game/engine/RaceSimulation";
import { findRacer, RacePhase } from "@/game/state/RaceState";

import type { RaceMode, RecordOutcome } from "./scoreBook";
import { useScores } from "./ScoresContext";

/**
 * Saves the local player's result once per race: when they cross the line, or as a
 * DNF if the race ends without them. Returns any personal bests set (for the HUD).
 */
export function useRecordRaceResult(
  engine: RaceSimulation,
  carId: CarId,
  mode: RaceMode,
): RecordOutcome | null {
  const { record } = useScores();
  const [outcome, setOutcome] = useState<RecordOutcome | null>(null);

  const save = useEffectEvent((finished: boolean) => {
    const { race, track, cars } = engine.state;
    const racer = findRacer(race, carId);
    if (!racer) return;
    const position = race.finishOrder.indexOf(carId);
    setOutcome(
      record({
        trackId: track.definition.id,
        laps: race.laps,
        mode,
        totalTicks: finished ? racer.finishTicks : null,
        bestLapTicks: racer.bestLapTicks,
        position: position >= 0 ? position + 1 : null,
        racers: cars.length,
        at: Date.now(),
      }),
    );
  });

  useEffect(() => {
    let recorded = false;
    return engine.subscribe((event) => {
      if (event.type === "carFinished" && event.carId === carId && !recorded) {
        recorded = true;
        save(true);
      } else if (event.type === "phaseChanged" && event.phase === RacePhase.Results && !recorded) {
        recorded = true;
        save(false);
      } else if (event.type === "phaseChanged" && event.phase === RacePhase.Countdown) {
        // "Race again": a fresh race to record.
        recorded = false;
        setOutcome(null);
      }
    });
  }, [engine, carId]);

  return outcome;
}
