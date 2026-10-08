import { useEffect, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { SIM_HZ } from "@/game/constants/PhysicsConstants";
import type { CarId } from "@/game/entities/Car";
import type { RaceSimulation } from "@/game/engine/RaceSimulation";
import { WrongWayDetector } from "@/game/engine/WrongWayDetector";
import type { Pose } from "@/game/math/geometry";
import type { GameEvent } from "@/game/state/GameEvents";
import type { GameState } from "@/game/state/GameState";
import { canRacerDrive, findRacer, racerElapsedTicks } from "@/game/state/RaceState";

import { IMPACT_SHAKE, MPS_TO_KMH, PX_PER_METER } from "./RenderConstants";
import {
  createSnapshot,
  SNAP_BOOST,
  SNAP_CAR_STRIDE,
  SNAP_CARS_OFFSET,
  SNAP_RACE_SECONDS,
  SNAP_SPEED_KMH,
  SNAP_WRONG_WAY,
} from "./RenderSnapshot";
import type { WorldView } from "./WorldView";

/**
 * Bridges the simulation to the screen once per display frame: interpolates
 * car poses, draws the world view (JS thread, same frame as the simulation),
 * and publishes a small snapshot for UI-thread HUD widgets.
 */
export class GameRenderer {
  private view: WorldView | null = null;
  private readonly poses: Pose[];
  private readonly followIndex: number;
  private readonly wrongWay: WrongWayDetector;

  constructor(
    private readonly engine: RaceSimulation,
    readonly snapshot: SharedValue<number[]>,
    private readonly followCarId: CarId,
  ) {
    const { cars } = engine.state;
    this.poses = cars.map(() => ({ x: 0, y: 0, angle: 0 }));
    this.followIndex = Math.max(0, cars.findIndex((car) => car.id === followCarId));
    this.wrongWay = new WrongWayDetector(engine.state.track);
  }

  attach(): () => void {
    this.engine.setFrameListener(this.onFrame);
    const unsubscribe = this.engine.subscribe(this.onEvent);
    return () => {
      this.engine.setFrameListener(null);
      unsubscribe();
    };
  }

  /** Replaces (and disposes) the current world view. */
  setView(view: WorldView | null): void {
    this.view?.dispose();
    this.view = view;
  }

  private readonly onEvent = (event: GameEvent): void => {
    if (event.type === "impact" && event.carId === this.followCarId) {
      const { minImpact, fullImpact } = IMPACT_SHAKE;
      this.view?.addShake((event.impactSpeed - minImpact) / (fullImpact - minImpact));
    }
  };

  private readonly onFrame = (state: GameState, alpha: number, frameDt: number): void => {
    const { cars, race, tick } = state;
    // Shared values are serialized (and cached) per object, so each frame needs a new array.
    const next = createSnapshot(cars.length);

    this.engine.writeRenderPoses(alpha, this.poses);
    for (let i = 0; i < cars.length; i++) {
      const base = SNAP_CARS_OFFSET + i * SNAP_CAR_STRIDE;
      next[base] = this.poses[i].x;
      next[base + 1] = this.poses[i].y;
    }

    this.view?.render(state, this.poses, this.followIndex, frameDt);

    const player = cars[this.followIndex];
    const racer = findRacer(race, player.id);
    next[SNAP_SPEED_KMH] = (Math.abs(player.forwardSpeed) / PX_PER_METER) * MPS_TO_KMH;
    next[SNAP_BOOST] = player.boostEnergy;
    next[SNAP_RACE_SECONDS] = racer ? racerElapsedTicks(race, racer, tick) / SIM_HZ : 0;

    // Only warn while actually racing (not on the grid, and not after crossing the line).
    if (racer && canRacerDrive(race, racer)) {
      const pose = this.poses[this.followIndex];
      next[SNAP_WRONG_WAY] = this.wrongWay.update(pose.x, pose.y, pose.angle, player.forwardSpeed, frameDt) ? 1 : 0;
    } else {
      this.wrongWay.reset();
    }
    this.snapshot.set(next);
  };
}

export function useGameRenderer(engine: RaceSimulation, followCarId: CarId): GameRenderer {
  const snapshot = useSharedValue(createSnapshot(engine.state.cars.length));
  const [renderer] = useState(() => new GameRenderer(engine, snapshot, followCarId));
  useEffect(() => renderer.attach(), [renderer]);
  return renderer;
}
