import { FIXED_DT } from "@/game/constants/PhysicsConstants";
import { MAX_PLAYERS } from "@/game/constants/RaceConstants";
import { Car, type CarId } from "@/game/entities/Car";
import { buildTrack, type TrackDefinition } from "@/game/entities/Track";
import { lerp, lerpAngle, type Pose } from "@/game/math/geometry";
import { copyInput, createNeutralInput, NEUTRAL_INPUT, type CarInput } from "@/game/state/CarInput";
import type { GameEvent, GameEventListener } from "@/game/state/GameEvents";
import type { GameState } from "@/game/state/GameState";
import { createRaceState } from "@/game/state/RaceState";

import { CarController } from "./CarController";
import { FixedStepLoop } from "./FixedStepLoop";
import { PhysicsEngine } from "./PhysicsEngine";
import { RaceEngine } from "./RaceEngine";
import type { FrameListener, RaceSimulation } from "./RaceSimulation";

export type { FrameListener } from "./RaceSimulation";

export interface GameEngineConfig {
  track: TrackDefinition;
  /** One car per id, in grid order. */
  carIds: readonly CarId[];
  /** Overrides the track's default lap count. */
  laps?: number;
}

/** Hooks around each fixed tick, e.g. for a network host to feed inputs and emit snapshots. */
export interface StepHooks {
  beforeStep?(tick: number): void;
  afterStep?(tick: number): void;
}

/**
 * Owns the simulation and the fixed-timestep loop. Has no React/rendering
 * dependencies: input goes in via `setInput`, state/events come out.
 */
export class GameEngine implements RaceSimulation {
  readonly state: GameState;

  private readonly physics = new PhysicsEngine();
  private readonly controller = new CarController();
  private readonly race: RaceEngine;
  /** Latest input per car (index-aligned with `state.cars`). */
  private readonly inputs: CarInput[];
  private readonly listeners = new Set<GameEventListener>();
  private readonly stepHooks = new Set<StepHooks>();
  private frameListener: FrameListener | null = null;
  private readonly loop = new FixedStepLoop(
    () => this.step(),
    (alpha, frameDt) => this.frameListener?.(this.state, alpha, frameDt),
  );

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

  // ---- Input / commands (local controls or a network host call these) ----

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

  addStepHooks(hooks: StepHooks): () => void {
    this.stepHooks.add(hooks);
    return () => {
      this.stepHooks.delete(hooks);
    };
  }

  setFrameListener(listener: FrameListener | null): void {
    this.frameListener = listener;
  }

  writeRenderPoses(alpha: number, out: Pose[]): void {
    const { cars } = this.state;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const pose = out[i];
      pose.x = lerp(car.prevX, car.x, alpha);
      pose.y = lerp(car.prevY, car.y, alpha);
      pose.angle = lerpAngle(car.prevAngle, car.angle, alpha);
    }
  }

  // ---- Loop ----

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
    this.stepHooks.clear();
    this.frameListener = null;
    this.physics.dispose();
  }

  /** Advances exactly one fixed tick. Public so a headless host or tests can drive it. */
  step(): void {
    for (const hooks of this.stepHooks) hooks.beforeStep?.(this.state.tick);

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

    for (const hooks of this.stepHooks) hooks.afterStep?.(this.state.tick);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private indexOf(carId: CarId): number {
    const { cars } = this.state;
    for (let i = 0; i < cars.length; i++) if (cars[i].id === carId) return i;
    return -1;
  }
}
