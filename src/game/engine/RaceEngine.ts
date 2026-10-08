import { SIM_HZ } from "@/game/constants/PhysicsConstants";
import { COUNTDOWN_TICKS, FINISHING_MIN_TICKS, FINISHING_TIMEOUT_TICKS } from "@/game/constants/RaceConstants";
import type { Car } from "@/game/entities/Car";
import { crossesCheckpoint } from "@/game/entities/Checkpoint";
import type { Track } from "@/game/entities/Track";
import type { GameEvent } from "@/game/state/GameEvents";
import {
  canRacerDrive,
  RacePhase,
  resetRacerProgress,
  type RaceState,
  type RacerProgress,
} from "@/game/state/RaceState";

const ALLOWED_TRANSITIONS: Record<RacePhase, readonly RacePhase[]> = {
  [RacePhase.Lobby]: [RacePhase.Countdown],
  [RacePhase.Countdown]: [RacePhase.Racing, RacePhase.Lobby],
  [RacePhase.Racing]: [RacePhase.Finishing, RacePhase.Lobby],
  [RacePhase.Finishing]: [RacePhase.Results, RacePhase.Lobby],
  [RacePhase.Results]: [RacePhase.Lobby],
};

/**
 * Race rules and the phase state machine. Phases change only through the
 * public commands (which a multiplayer host can call) or this engine's own timers.
 */
export class RaceEngine {
  private lastCountdownSecond = -1;

  constructor(
    private readonly state: RaceState,
    private readonly track: Track,
    private readonly emit: (event: GameEvent) => void,
  ) {}

  /** Whether driver input should reach the cars this tick. */
  canDrive(racer: RacerProgress): boolean {
    return canRacerDrive(this.state, racer);
  }

  // ---- Commands ----

  startCountdown(tick: number): boolean {
    return this.transition(RacePhase.Countdown, tick);
  }

  /** Back to LOBBY with fresh progress. Car positions are reset by GameEngine. */
  reset(tick: number): void {
    for (const racer of this.state.racers) resetRacerProgress(racer, tick, this.state.checkpointCount);
    this.state.finishOrder.length = 0;
    this.lastCountdownSecond = -1;
    if (this.state.phase !== RacePhase.Lobby) this.transition(RacePhase.Lobby, tick);
  }

  // ---- Tick ----

  update(tick: number, cars: readonly Car[]): void {
    const { state } = this;
    const elapsed = tick - state.phaseStartTick;

    switch (state.phase) {
      case RacePhase.Countdown: {
        const secondsLeft = Math.ceil((COUNTDOWN_TICKS - elapsed) / SIM_HZ);
        if (secondsLeft !== this.lastCountdownSecond && secondsLeft > 0) {
          this.lastCountdownSecond = secondsLeft;
          this.emit({ type: "countdown", secondsLeft });
        }
        if (elapsed >= COUNTDOWN_TICKS) this.beginRacing(tick);
        break;
      }
      case RacePhase.Racing:
        this.updateProgress(tick, cars);
        if (state.finishOrder.length > 0) this.transition(RacePhase.Finishing, tick);
        break;
      case RacePhase.Finishing: {
        this.updateProgress(tick, cars);
        const everyoneDone = state.finishOrder.length === state.racers.length;
        if ((everyoneDone && elapsed >= FINISHING_MIN_TICKS) || elapsed >= FINISHING_TIMEOUT_TICKS) {
          this.transition(RacePhase.Results, tick);
        }
        break;
      }
      case RacePhase.Lobby:
      case RacePhase.Results:
        break;
    }
  }

  private beginRacing(tick: number): void {
    this.state.raceStartTick = tick;
    for (const racer of this.state.racers) resetRacerProgress(racer, tick, this.state.checkpointCount);
    this.transition(RacePhase.Racing, tick);
  }

  private updateProgress(tick: number, cars: readonly Car[]): void {
    const { racers } = this.state;
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i];
      if (racer.finishTicks !== null) continue;
      const car = cars[i];
      const checkpoint = this.track.checkpoints[racer.nextCheckpoint];
      if (!crossesCheckpoint(checkpoint, car.prevX, car.prevY, car.x, car.y)) continue;

      racer.nextCheckpoint = (racer.nextCheckpoint + 1) % this.state.checkpointCount;
      if (checkpoint.isFinishLine) {
        this.completeLap(racer, tick);
      } else {
        this.emit({ type: "checkpoint", carId: racer.carId, index: checkpoint.index });
      }
    }
  }

  private completeLap(racer: RacerProgress, tick: number): void {
    const lapTicks = tick - racer.lapStartTick;
    racer.completedLaps++;
    racer.lastLapTicks = lapTicks;
    racer.bestLapTicks = racer.bestLapTicks === null ? lapTicks : Math.min(racer.bestLapTicks, lapTicks);
    racer.lapTimes.push(lapTicks);
    racer.lapStartTick = tick;
    this.emit({ type: "lapCompleted", carId: racer.carId, completedLaps: racer.completedLaps, lapTicks });

    if (racer.completedLaps >= this.state.laps) {
      racer.finishTicks = tick - this.state.raceStartTick;
      this.state.finishOrder.push(racer.carId);
      this.emit({
        type: "carFinished",
        carId: racer.carId,
        position: this.state.finishOrder.length,
        totalTicks: racer.finishTicks,
      });
    }
  }

  private transition(next: RacePhase, tick: number): boolean {
    if (!ALLOWED_TRANSITIONS[this.state.phase].includes(next)) return false;
    this.state.phase = next;
    this.state.phaseStartTick = tick;
    this.emit({ type: "phaseChanged", phase: next, tick });
    return true;
  }
}
