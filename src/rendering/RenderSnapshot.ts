/**
 * Flat number array published to the UI thread once per frame for UI-thread
 * HUD widgets (live readouts, minimap). One shared-value write per frame.
 *
 * Layout: [speedKmh, raceSeconds, boost, ...cars(x, y)]
 */
export const SNAP_SPEED_KMH = 0;
export const SNAP_RACE_SECONDS = 1;
export const SNAP_BOOST = 2;
export const SNAP_CARS_OFFSET = 3;
export const SNAP_CAR_STRIDE = 2;

export function createSnapshot(carCount: number): number[] {
  return new Array<number>(SNAP_CARS_OFFSET + carCount * SNAP_CAR_STRIDE).fill(0);
}
