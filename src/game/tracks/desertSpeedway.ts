import type { TrackDefinition } from "@/game/entities/Track";

/** Wide, fast oval with a gentle kink on the back straight. */
export const DESERT_SPEEDWAY: TrackDefinition = {
  id: "desert-speedway",
  name: "Desert Speedway",
  environment: "desert",
  laps: 5,
  width: 260,
  controlPoints: [
    { x: 1400, y: 300 },
    { x: 2200, y: 300 },
    { x: 2650, y: 450 },
    { x: 2800, y: 800 },
    { x: 2650, y: 1150 },
    { x: 2200, y: 1300 },
    { x: 1800, y: 1300 },
    { x: 1400, y: 1200 },
    { x: 1000, y: 1300 },
    { x: 600, y: 1300 },
    { x: 150, y: 1150 },
    { x: 0, y: 800 },
    { x: 150, y: 450 },
    { x: 600, y: 300 },
  ],
  checkpoints: [0, 0.2, 0.4, 0.6, 0.8],
};
