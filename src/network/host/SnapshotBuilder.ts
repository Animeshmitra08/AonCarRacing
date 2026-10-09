import type { GameState } from "@/game/state/GameState";
import {
  CAR_STATE_STRIDE,
  CS_ACCELERATING,
  CS_ANGLE,
  CS_BOOST_ENERGY,
  CS_BOOSTING,
  CS_BRAKING,
  CS_FORWARD_SPEED,
  CS_STEER,
  CS_VX,
  CS_VY,
  CS_X,
  CS_Y,
  type HostMessage,
  type PlayerId,
} from "@/network/protocol";

const round = (value: number, places: number) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

/** Authoritative state → compact snapshot message. Rounding keeps the JSON small. */
export function buildSnapshot(state: GameState, acks: Record<PlayerId, number>): HostMessage {
  const cars = new Array<number>(state.cars.length * CAR_STATE_STRIDE);
  state.cars.forEach((car, i) => {
    const base = i * CAR_STATE_STRIDE;
    cars[base + CS_X] = round(car.x, 2);
    cars[base + CS_Y] = round(car.y, 2);
    cars[base + CS_ANGLE] = round(car.angle, 4);
    cars[base + CS_VX] = round(car.body.velocity.x, 4);
    cars[base + CS_VY] = round(car.body.velocity.y, 4);
    cars[base + CS_STEER] = round(car.steer, 3);
    cars[base + CS_FORWARD_SPEED] = round(car.forwardSpeed, 1);
    cars[base + CS_BOOST_ENERGY] = round(car.boostEnergy, 3);
    cars[base + CS_BOOSTING] = car.boosting ? 1 : 0;
    cars[base + CS_ACCELERATING] = car.accelerating ? 1 : 0;
    cars[base + CS_BRAKING] = car.braking ? 1 : 0;
  });
  return { type: "snapshot", tick: state.tick, cars, acks, race: state.race };
}
