import type { TrackDefinition } from "@/game/entities/Track";

/** Long, narrow mountain loop: an S-bend, a hairpin at the far end and a fast return. */
export const GLACIER_SWITCHBACKS: TrackDefinition = {
  id: "glacier-switchbacks",
  name: "Glacier Switchbacks",
  environment: "snow",
  laps: 2,
  width: 180,
  controlPoints: [
    { x: 1000, y: 300 },
    { x: 1700, y: 300 },
    { x: 2200, y: 500 },
    { x: 2300, y: 900 },
    { x: 1900, y: 1100 },
    { x: 1400, y: 1000 },
    { x: 1000, y: 1150 },
    { x: 1100, y: 1500 },
    { x: 1600, y: 1600 },
    { x: 2200, y: 1700 },
    { x: 2500, y: 2100 },
    { x: 2200, y: 2500 },
    { x: 1500, y: 2600 },
    { x: 900, y: 2450 },
    { x: 500, y: 2100 },
    { x: 600, y: 1700 },
    { x: 350, y: 1300 },
    { x: 300, y: 800 },
    { x: 550, y: 450 },
  ],
  checkpoints: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875],
};
