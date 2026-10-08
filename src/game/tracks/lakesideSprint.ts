import type { TrackDefinition } from "@/game/entities/Track";

/** Wide, fast meadow circuit: long straights and one kink on the lakeside back stretch. */
export const LAKESIDE_SPRINT: TrackDefinition = {
  id: "lakeside-sprint",
  name: "Lakeside Sprint",
  environment: "meadow",
  laps: 4,
  width: 240,
  controlPoints: [
    { x: 1200, y: 300 },
    { x: 2000, y: 300 },
    { x: 2700, y: 400 },
    { x: 3000, y: 800 },
    { x: 2900, y: 1300 },
    { x: 2400, y: 1500 },
    { x: 1800, y: 1400 },
    { x: 1300, y: 1550 },
    { x: 700, y: 1500 },
    { x: 300, y: 1200 },
    { x: 250, y: 700 },
    { x: 600, y: 350 },
  ],
  checkpoints: [0, 0.17, 0.33, 0.5, 0.67, 0.83],
};
