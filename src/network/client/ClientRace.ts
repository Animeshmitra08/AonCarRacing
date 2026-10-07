import Matter from "matter-js";

import { FIXED_DT } from "@/game/constants/PhysicsConstants";
import { CarController } from "@/game/engine/CarController";
import { FixedStepLoop } from "@/game/engine/FixedStepLoop";
import { PhysicsEngine } from "@/game/engine/PhysicsEngine";
import type { FrameListener, RaceSimulation } from "@/game/engine/RaceSimulation";
import { Car } from "@/game/entities/Car";
import { buildTrack } from "@/game/entities/Track";
import { lerp, lerpAngle, type Pose } from "@/game/math/geometry";
import { copyInput, createNeutralInput, NEUTRAL_INPUT, type CarInput } from "@/game/state/CarInput";
import type { GameEvent, GameEventListener } from "@/game/state/GameEvents";
import type { GameState } from "@/game/state/GameState";
import { canRacerDrive, createRaceState, type RaceState } from "@/game/state/RaceState";
import { findTrack } from "@/game/tracks";
import {
  CORRECTION_SMOOTHING_RATE,
  CORRECTION_SNAP_DISTANCE,
  INPUT_SEND_INTERVAL_TICKS,
  INTERPOLATION_DELAY_TICKS,
  MAX_PENDING_INPUTS,
} from "@/network/constants";
import {
  CAR_STATE_STRIDE,
  CS_ANGLE,
  CS_BOOST_ENERGY,
  CS_BOOSTING,
  CS_FORWARD_SPEED,
  CS_STEER,
  CS_VX,
  CS_VY,
  CS_X,
  CS_Y,
  inputToFrame,
  type InputFrame,
  type PlayerId,
  type RaceStartInfo,
} from "@/network/protocol";

import { SnapshotBuffer } from "./SnapshotBuffer";

interface PendingInput {
  seq: number;
  input: CarInput;
}

const scratchPose: Pose = { x: 0, y: 0, angle: 0 };
const scratchVector = { x: 0, y: 0 };

/**
 * A client's view of a networked race.
 *
 * - Own car: predicted locally every tick with the same controller + physics as
 *   the host, then reconciled against each snapshot (reset to the authoritative
 *   state and replay inputs the host hasn't processed yet).
 * - Other cars: interpolated between buffered snapshots, drawn slightly in the past.
 * - Race rules/progress: mirrored from the host, never computed here.
 */
export class ClientRace implements RaceSimulation {
  readonly state: GameState;

  private readonly physics = new PhysicsEngine();
  private readonly controller = new CarController();
  private readonly localIndex: number;
  private readonly localInput = createNeutralInput();
  private readonly pending: PendingInput[] = [];
  private outgoing: InputFrame[] = [];
  private inputSeq = 0;

  private readonly snapshots = new SnapshotBuffer();
  private localTick = 0;
  private latestServerTick = -1;
  private localTickAtLatest = 0;

  /** Visual-only offset that hides reconciliation snaps; decays to zero. */
  private errorX = 0;
  private errorY = 0;
  private errorAngle = 0;
  private replaying = false;

  private readonly listeners = new Set<GameEventListener>();
  private frameListener: FrameListener | null = null;
  private readonly loop = new FixedStepLoop(
    () => this.step(),
    (alpha, frameDt) => this.frameListener?.(this.state, alpha, frameDt),
  );

  constructor(
    info: RaceStartInfo,
    private readonly localId: PlayerId,
    private readonly sendInputs: (frames: InputFrame[]) => void,
  ) {
    const track = buildTrack(findTrack(info.trackId));
    this.physics.addTrackWalls(track);
    const ids = info.players.map((p) => p.id);
    const cars = ids.map((id, slot) => new Car(id, slot, this.physics.createCarBody(id, track.startGrid[slot])));
    this.localIndex = ids.indexOf(localId);

    // Remote cars are only shown where they were ~100 ms ago, so colliding with them
    // locally would predict contacts that never happen on the host. Car-vs-car contact
    // is left to the host (corrections arrive in snapshots); walls are still predicted.
    cars.forEach((car, i) => {
      if (i === this.localIndex) return;
      Matter.Body.setStatic(car.body, true);
      car.body.collisionFilter.category = 0;
    });

    this.physics.setImpactListener((carId, impactSpeed) => {
      if (!this.replaying && carId === localId) this.emit({ type: "impact", carId, impactSpeed });
    });

    this.state = {
      tick: 0,
      track,
      cars,
      race: createRaceState(ids, info.laps, track.checkpoints.length),
    };
  }

  // ---- RaceSimulation ----

  subscribe(listener: GameEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setFrameListener(listener: FrameListener | null): void {
    this.frameListener = listener;
  }

  writeRenderPoses(alpha: number, out: Pose[]): void {
    const { cars } = this.state;
    const renderTick = this.estimatedServerTick() + alpha - INTERPOLATION_DELAY_TICKS;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const pose = out[i];
      if (i === this.localIndex) {
        pose.x = lerp(car.prevX, car.x, alpha) + this.errorX;
        pose.y = lerp(car.prevY, car.y, alpha) + this.errorY;
        pose.angle = lerpAngle(car.prevAngle, car.angle, alpha) + this.errorAngle;
      } else if (!this.snapshots.sample(renderTick, i, pose)) {
        pose.x = car.x;
        pose.y = car.y;
        pose.angle = car.angle;
      }
    }
  }

  // ---- Local control ----

  setLocalInput(input: Readonly<CarInput>): void {
    copyInput(input, this.localInput);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
    this.frameListener = null;
    this.physics.dispose();
  }

  // ---- From the host ----

  applySnapshot(tick: number, cars: number[], ack: number, race: RaceState): void {
    if (cars.length !== this.state.cars.length * CAR_STATE_STRIDE) return;
    this.snapshots.push(tick, cars);
    if (tick > this.latestServerTick) {
      this.latestServerTick = tick;
      this.localTickAtLatest = this.localTick;
    }
    this.mirrorRace(race);
    this.applyRemoteCosmetics(cars);
    this.reconcile(cars, ack);
  }

  applyEvent(event: GameEvent, race: RaceState): void {
    this.mirrorRace(race);
    this.emit(event);
  }

  // ---- Simulation ----

  private step(): void {
    const seq = ++this.inputSeq;
    const input = { ...this.localInput };
    this.pending.push({ seq, input });
    if (this.pending.length > MAX_PENDING_INPUTS) this.pending.shift();
    this.outgoing.push(inputToFrame(seq, input));

    this.placeRemoteCars(this.estimatedServerTick() - INTERPOLATION_DELAY_TICKS);
    this.predictLocal(input);
    this.localTick++;
    this.state.tick = Math.max(0, Math.round(this.estimatedServerTick()));

    if (this.localTick % INPUT_SEND_INTERVAL_TICKS === 0 && this.outgoing.length > 0) {
      this.sendInputs(this.outgoing);
      this.outgoing = [];
    }

    const decay = Math.exp(-CORRECTION_SMOOTHING_RATE * FIXED_DT);
    this.errorX *= decay;
    this.errorY *= decay;
    this.errorAngle *= decay;
  }

  private predictLocal(input: Readonly<CarInput>): void {
    if (this.localIndex < 0) return;
    const car = this.state.cars[this.localIndex];
    const racer = this.state.race.racers[this.localIndex];
    car.recordPreviousPose();
    this.controller.update(car, canRacerDrive(this.state.race, racer) ? input : NEUTRAL_INPUT, FIXED_DT);
    this.physics.step();
  }

  /** Reset own car to the host's state, then replay inputs the host hasn't applied yet. */
  private reconcile(cars: number[], ack: number): void {
    if (this.localIndex < 0) return;
    const car = this.state.cars[this.localIndex];
    const beforeX = car.x;
    const beforeY = car.y;
    const beforeAngle = car.angle;

    applyCarState(car, cars, this.localIndex * CAR_STATE_STRIDE);
    while (this.pending.length > 0 && this.pending[0].seq <= ack) this.pending.shift();

    this.replaying = true;
    for (const { input } of this.pending) this.predictLocal(input);
    this.replaying = false;
    if (this.pending.length === 0) car.recordPreviousPose();

    const dx = beforeX - car.x;
    const dy = beforeY - car.y;
    if (Math.hypot(dx + this.errorX, dy + this.errorY) > CORRECTION_SNAP_DISTANCE) {
      this.errorX = this.errorY = this.errorAngle = 0;
    } else {
      this.errorX += dx;
      this.errorY += dy;
      this.errorAngle += lerpAngle(car.angle, beforeAngle, 1) - car.angle;
    }
  }

  private placeRemoteCars(tick: number): void {
    const { cars } = this.state;
    for (let i = 0; i < cars.length; i++) {
      if (i === this.localIndex || !this.snapshots.sample(tick, i, scratchPose)) continue;
      const car = cars[i];
      car.recordPreviousPose();
      scratchVector.x = scratchPose.x;
      scratchVector.y = scratchPose.y;
      Matter.Body.setPosition(car.body, scratchVector);
      Matter.Body.setAngle(car.body, scratchPose.angle);
    }
  }

  /** Steering/boost/speed drive remote cars' wheel and flame visuals. */
  private applyRemoteCosmetics(cars: number[]): void {
    this.state.cars.forEach((car, i) => {
      if (i === this.localIndex) return;
      const base = i * CAR_STATE_STRIDE;
      car.steer = cars[base + CS_STEER];
      car.forwardSpeed = cars[base + CS_FORWARD_SPEED];
      car.boostEnergy = cars[base + CS_BOOST_ENERGY];
      car.boosting = cars[base + CS_BOOSTING] === 1;
    });
  }

  private mirrorRace(source: RaceState): void {
    const race = this.state.race;
    race.phase = source.phase;
    race.phaseStartTick = source.phaseStartTick;
    race.raceStartTick = source.raceStartTick;
    source.racers.forEach((src, i) => {
      const racer = race.racers[i];
      if (!racer || src.carId !== racer.carId) return;
      racer.completedLaps = src.completedLaps;
      racer.nextCheckpoint = src.nextCheckpoint;
      racer.lapStartTick = src.lapStartTick;
      racer.lastLapTicks = src.lastLapTicks;
      racer.bestLapTicks = src.bestLapTicks;
      racer.finishTicks = src.finishTicks;
    });
    race.finishOrder.length = 0;
    race.finishOrder.push(...source.finishOrder);
  }

  /** Host tick we believe is "now": latest snapshot plus local ticks elapsed since it arrived. */
  private estimatedServerTick(): number {
    if (this.latestServerTick < 0) return 0;
    return this.latestServerTick + (this.localTick - this.localTickAtLatest);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function applyCarState(car: Car, cars: number[], base: number): void {
  scratchVector.x = cars[base + CS_X];
  scratchVector.y = cars[base + CS_Y];
  Matter.Body.setPosition(car.body, scratchVector);
  Matter.Body.setAngle(car.body, cars[base + CS_ANGLE]);
  scratchVector.x = cars[base + CS_VX];
  scratchVector.y = cars[base + CS_VY];
  Matter.Body.setVelocity(car.body, scratchVector);
  car.steer = cars[base + CS_STEER];
  car.forwardSpeed = cars[base + CS_FORWARD_SPEED];
  car.boostEnergy = cars[base + CS_BOOST_ENERGY];
  car.boosting = cars[base + CS_BOOSTING] === 1;
}
