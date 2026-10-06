import { useEffect, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { SIM_HZ } from "@/game/constants/PhysicsConstants";
import type { CarId } from "@/game/entities/Car";
import type { GameEngine } from "@/game/engine/GameEngine";
import { lerp, lerpAngle, type Pose } from "@/game/math/geometry";
import type { GameEvent } from "@/game/state/GameEvents";
import type { GameState } from "@/game/state/GameState";
import { findRacer, racerElapsedTicks } from "@/game/state/RaceState";

import { IMPACT_SHAKE, MPS_TO_KMH, PX_PER_METER } from "./RenderConstants";
import {
  createSnapshot,
  SNAP_BOOST,
  SNAP_CAR_STRIDE,
  SNAP_CARS_OFFSET,
  SNAP_RACE_SECONDS,
  SNAP_SPEED_KMH,
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

  constructor(
    private readonly engine: GameEngine,
    readonly snapshot: SharedValue<number[]>,
    private readonly followCarId: CarId,
  ) {
    const { cars } = engine.state;
    this.poses = cars.map(() => ({ x: 0, y: 0, angle: 0 }));
    this.followIndex = Math.max(0, cars.findIndex((car) => car.id === followCarId));
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

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const pose = this.poses[i];
      pose.x = lerp(car.prevX, car.x, alpha);
      pose.y = lerp(car.prevY, car.y, alpha);
      pose.angle = lerpAngle(car.prevAngle, car.angle, alpha);
      const base = SNAP_CARS_OFFSET + i * SNAP_CAR_STRIDE;
      next[base] = pose.x;
      next[base + 1] = pose.y;
    }

    this.view?.render(state, this.poses, this.followIndex, frameDt);

    const player = cars[this.followIndex];
    const racer = findRacer(race, player.id);
    next[SNAP_SPEED_KMH] = (Math.abs(player.forwardSpeed) / PX_PER_METER) * MPS_TO_KMH;
    next[SNAP_BOOST] = player.boostEnergy;
    next[SNAP_RACE_SECONDS] = racer ? racerElapsedTicks(race, racer, tick) / SIM_HZ : 0;
    this.snapshot.set(next);
  };
}

export function useGameRenderer(engine: GameEngine, followCarId: CarId): GameRenderer {
  const snapshot = useSharedValue(createSnapshot(engine.state.cars.length));
  const [renderer] = useState(() => new GameRenderer(engine, snapshot, followCarId));
  useEffect(() => renderer.attach(), [renderer]);
  return renderer;
}
