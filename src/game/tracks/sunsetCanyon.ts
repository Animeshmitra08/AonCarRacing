import type { TrackDefinition } from "@/game/entities/Track";

/** Flowing desert run with a tight chicane through the middle of the canyon. */
export const SUNSET_CANYON: TrackDefinition = {
  id: "sunset-canyon",
  name: "Sunset Canyon",
  environment: "desert",
  laps: 3,
  width: 200,
  controlPoints: [
    { x: 800, y: 400 },
    { x: 1500, y: 400 },
    { x: 2100, y: 450 },
    { x: 2500, y: 700 },
    { x: 2600, y: 1100 },
    { x: 2300, y: 1350 },
    { x: 1900, y: 1250 },
    { x: 1600, y: 1450 },
    { x: 1700, y: 1850 },
    { x: 1350, y: 2150 },
    { x: 800, y: 2100 },
    { x: 450, y: 1800 },
    { x: 500, y: 1400 },
    { x: 300, y: 1000 },
    { x: 400, y: 600 },
  ],
  checkpoints: [0, 0.14, 0.28, 0.43, 0.57, 0.71, 0.86],
};
