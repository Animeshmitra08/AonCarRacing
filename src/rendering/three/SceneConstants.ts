import type { TrackEnvironment } from "@/game/entities/Track";

/** Scene units are metres; y is up. World (x, y) maps to scene (x, z). */

export const SCENE = {
  groundSize: 4000,
  hemiIntensity: 1.8,
  sun: "#fff2dd",
  sunIntensity: 2.2,
} as const;

export interface EnvironmentPalette {
  sky: string;
  fogNear: number;
  fogFar: number;
  ground: string;
  hemiSky: string;
  hemiGround: string;
  trunk: string;
  foliage: string;
}

export const ENVIRONMENTS: Record<TrackEnvironment, EnvironmentPalette> = {
  meadow: {
    sky: "#8fc7ff",
    fogNear: 140,
    fogFar: 560,
    ground: "#4c8a3f",
    hemiSky: "#e3f1ff",
    hemiGround: "#3a5a30",
    trunk: "#6b4a2b",
    foliage: "#2f6b2a",
  },
  desert: {
    sky: "#f5d7a1",
    fogNear: 120,
    fogFar: 520,
    ground: "#d8b273",
    hemiSky: "#fff1d6",
    hemiGround: "#9c7a45",
    trunk: "#7a5a33",
    foliage: "#6f8a3a",
  },
  snow: {
    sky: "#c9dcec",
    fogNear: 90,
    fogFar: 420,
    ground: "#eef3f7",
    hemiSky: "#f4f8ff",
    hemiGround: "#9fb0bf",
    trunk: "#4b3621",
    foliage: "#1f4d2c",
  },
};

export const TRACK_3D = {
  asphalt: "#45474d",
  laneMark: "#f2f2f2",
  kerbRed: "#d83a34",
  kerbWhite: "#f2f2f2",
  barrierA: "#1d5fd1",
  barrierB: "#f2f2f2",
  finishDark: "#1b1b1b",
  finishLight: "#fafafa",
  gantryPost: "#9aa0a6",
  gantryBanner: "#e63946",
  /** Small heights stack flat layers without z-fighting. */
  roadY: 0.02,
  kerbY: 0.035,
  markY: 0.04,
  kerbWidth: 1,
  laneMarkWidth: 0.25,
  barrierHeight: 1.1,
  barrierThickness: 0.6,
  /** Track samples per barrier colour panel. */
  barrierPanelSegments: 2,
  finishSquare: 1.4,
  gantryHeight: 6,
  gantryPostSize: 0.6,
  gantryBeamHeight: 1.4,
  gantryBeamDepth: 0.5,
  gantryOverhang: 1.5,
} as const;

export const SCENERY = {
  seed: 1337,
  treeCount: 180,
  maxPlacementAttempts: 2000,
  /** Distance range from the road edge, metres. */
  minEdgeDistance: 6,
  maxEdgeDistance: 45,
  trunkHeight: 1.6,
  trunkRadius: 0.25,
  foliageHeight: 5,
  foliageRadius: 2.2,
  minScale: 0.8,
  maxScale: 1.4,
} as const;

export type CameraMode = "close" | "far";

export interface ChaseCameraPreset {
  distance: number;
  distanceAtSpeed: number;
  height: number;
  heightAtSpeed: number;
}

export const CAMERA_PRESETS: Record<CameraMode, ChaseCameraPreset> = {
  close: { distance: 7, distanceAtSpeed: 8.5, height: 2.6, heightAtSpeed: 2.9 },
  far: { distance: 10, distanceAtSpeed: 12, height: 3.8, heightAtSpeed: 4.3 },
};

/** Asphalt-style third-person camera. Distances in metres, rates per second, FOV in degrees. */
export const CHASE_CAMERA = {
  lookAhead: 6,
  lookHeight: 1,
  /** How fast the camera swings round behind the car. Lower = more lag in corners. */
  yawFollowRate: 5,
  speedSmoothingRate: 3,
  baseFov: 62,
  speedFov: 74,
  boostFov: 8,
  /** Camera roll (radians) at full steering lock and speed. */
  steerRoll: 0.035,
  near: 0.3,
  far: 700,
  shakeDecay: 6,
  shakeAmplitude: 0.35,
  shakeFrequency: 40,
} as const;
