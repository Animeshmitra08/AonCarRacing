import { FIXED_DT, FIXED_DT_MS, MAX_FRAME_MS, MAX_STEPS_PER_FRAME } from "@/game/constants/PhysicsConstants";
import { MAX_PLAYERS } from "@/game/constants/RaceConstants";
import { Car, type CarId } from "@/game/entities/Car";
import { buildTrack, type TrackDefinition } from "@/game/entities/Track";
import { copyInput, createNeutralInput, NEUTRAL_INPUT, type CarInput } from "@/game/state/CarInput";
import type { GameEvent, GameEventListener } from "@/game/state/GameEvents";
import type { GameState } from "@/game/state/GameState";
import { createRaceState } from "@/game/state/RaceState";

import { CarController } from "./CarController";
import { PhysicsEngine } from "./PhysicsEngine";
import { RaceEngine } from "./RaceEngine";

export interface GameEngineConfig {
  track: TrackDefinition;
  /** One car per id, in grid order. */
  carIds: readonly CarId[];
  /** Overrides the track's default lap count. */
  laps?: number;
}

/** Called once per display frame after simulation; `alpha` is 0..1 between the last two ticks. */
export type FrameListener = (state: GameState, alpha: number, frameDt: number) => void;

/**
 * Owns the simulation and the fixed-timestep loop. Has no React/rendering
 * dependencies: input goes in via `setInput`, state/events come out.
 */
export class GameEngine {
  readonly state: GameState;

  private readonly physics = new PhysicsEngine();
  private readonly controller = new CarController();
  private readonly race: RaceEngine;
  /** Latest input per car (index-aligned with `state.cars`). */
  private readonly inputs: CarInput[];
  private readonly listeners = new Set<GameEventListener>();
  private frameListener: FrameListener | null = null;

  private rafId: number | null = null;
  private lastFrameTime = -1;
  private accumulator = 0;

  constructor(config: GameEngineConfig) {
    if (config.carIds.length === 0 || config.carIds.length > MAX_PLAYERS) {
      throw new Error(`GameEngine: expected 1-${MAX_PLAYERS} cars, got ${config.carIds.length}.`);
    }
    const track = buildTrack(config.track);
    this.physics.addTrackWalls(track);
    this.physics.setImpactListener((carId, impactSpeed) => this.emit({ type: "impact", carId, impactSpeed }));

    const cars = config.carIds.map(
      (id, slot) => new Car(id, slot, this.physics.createCarBody(id, track.startGrid[slot])),
    );
    this.inputs = cars.map(() => createNeutralInput());

    this.state = {
      tick: 0,
      track,
      cars,
      // racers[i] tracks cars[i].
      race: createRaceState(config.carIds, Math.max(1, Math.round(config.laps ?? track.laps)), track.checkpoints.length),
    };
    this.race = new RaceEngine(this.state.race, track, (event) => this.emit(event));
  }

  // ---- Input / commands (the seam a network layer will call later) ----

  setInput(carId: CarId, input: Readonly<CarInput>): void {
    const index = this.indexOf(carId);
    if (index >= 0) copyInput(input, this.inputs[index]);
  }

  startRace(): void {
    this.race.startCountdown(this.state.tick);
  }

  resetRace(): void {
    const { cars, track } = this.state;
    for (let i = 0; i < cars.length; i++) {
      cars[i].resetTo(track.startGrid[cars[i].slot]);
      copyInput(NEUTRAL_INPUT, this.inputs[i]);
    }
    this.race.reset(this.state.tick);
  }

  subscribe(listener: GameEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setFrameListener(listener: FrameListener | null): void {
    this.frameListener = listener;
  }

  // ---- Loop ----

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameTime = -1;
    this.rafId = requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
    this.frameListener = null;
    this.physics.dispose();
  }

  /** Advances exactly one fixed tick. Public so a headless host or tests can drive it. */
  step(): void {
    const { cars, race } = this.state;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      car.recordPreviousPose();
      const input = this.race.canDrive(race.racers[i]) ? this.inputs[i] : NEUTRAL_INPUT;
      this.controller.update(car, input, FIXED_DT);
    }
    this.physics.step();
    this.state.tick++;
    this.race.update(this.state.tick, cars);
  }

  private readonly onFrame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.onFrame);

    const frameMs = this.lastFrameTime < 0 ? FIXED_DT_MS : Math.min(now - this.lastFrameTime, MAX_FRAME_MS);
    this.lastFrameTime = now;
    this.accumulator += frameMs;

    let steps = 0;
    while (this.accumulator >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
      this.step();
      this.accumulator -= FIXED_DT_MS;
      steps++;
    }
    // Couldn't catch up: drop the backlog rather than spiral.
    if (this.accumulator >= FIXED_DT_MS) this.accumulator = 0;

    this.frameListener?.(this.state, this.accumulator / FIXED_DT_MS, frameMs / 1000);
  };

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private indexOf(carId: CarId): number {
    const { cars } = this.state;
    for (let i = 0; i < cars.length; i++) if (cars[i].id === carId) return i;
    return -1;
  }
}
