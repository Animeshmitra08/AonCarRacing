import type { TrackDefinition } from "@/game/entities/Track";

/** Narrow and technical: hairpins and an S-section. */
export const ALPINE_PASS: TrackDefinition = {
  id: "alpine-pass",
  name: "Alpine Pass",
  environment: "snow",
  laps: 3,
  width: 190,
  controlPoints: [
    { x: 900, y: 300 },
    { x: 1500, y: 300 },
    { x: 1950, y: 480 },
    { x: 1900, y: 850 },
    { x: 1400, y: 950 },
    { x: 1200, y: 1250 },
    { x: 1500, y: 1500 },
    { x: 2050, y: 1500 },
    { x: 2350, y: 1850 },
    { x: 2000, y: 2250 },
    { x: 1300, y: 2200 },
    { x: 750, y: 1900 },
    { x: 450, y: 1400 },
    { x: 700, y: 1000 },
    { x: 400, y: 650 },
    { x: 550, y: 330 },
  ],
  checkpoints: [0, 0.14, 0.28, 0.43, 0.57, 0.71, 0.86],
};
