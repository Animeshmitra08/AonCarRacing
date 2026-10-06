import type { TrackDefinition } from "@/game/entities/Track";

/**
 * Pure data. Physics walls, checkpoints, the start grid and rendering are all
 * derived from this by `buildTrack`, so it can be shared/synced as-is later.
 */
export const GREEN_VALLEY: TrackDefinition = {
  id: "green-valley",
  name: "Green Valley",
  environment: "meadow",
  laps: 3,
  width: 220,
  // Driven in this order (clockwise from above). The first point is the finish line.
  controlPoints: [
    { x: 1000, y: 300 },
    { x: 1450, y: 300 },
    { x: 1950, y: 360 },
    { x: 2250, y: 700 },
    { x: 2100, y: 1080 },
    { x: 1650, y: 1080 },
    { x: 1350, y: 1300 },
    { x: 1450, y: 1650 },
    { x: 1100, y: 1900 },
    { x: 550, y: 1800 },
    { x: 280, y: 1350 },
    { x: 330, y: 720 },
    { x: 600, y: 320 },
  ],
  // Fractions of lap distance. Must start at 0 (the finish line).
  checkpoints: [0, 0.17, 0.33, 0.5, 0.67, 0.83],
};
