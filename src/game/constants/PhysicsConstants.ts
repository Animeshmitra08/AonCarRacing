/** Simulation runs at a fixed rate, independent of the display refresh rate. */
export const SIM_HZ = 60;
export const FIXED_DT = 1 / SIM_HZ;
export const FIXED_DT_MS = 1000 / SIM_HZ;

/** Clamp long frames (app resumed, debugger pause) so we don't fast-forward the race. */
export const MAX_FRAME_MS = 250;
/** Guard against the "spiral of death" when a device can't keep up. */
export const MAX_STEPS_PER_FRAME = 5;

/** Matter.js expresses velocity as distance per base delta (16.67ms), not per second. */
const MATTER_BASE_DELTA_MS = 1000 / 60;
export const MATTER_VELOCITY_TO_PX_PER_SEC = 1000 / MATTER_BASE_DELTA_MS;

export const CAR_DIMENSIONS = {
  length: 44,
  width: 22,
} as const;

/** Matter body properties for cars. Driving forces come from CarController, not Matter. */
export const CAR_BODY = {
  density: 0.002,
  friction: 0.02,
  restitution: 0.25,
  chamferRadius: 6,
} as const;

export const WALL_BODY = {
  thickness: 40,
  friction: 0,
  restitution: 0.35,
} as const;

/** Arcade handling model. Speeds are px/s, accelerations px/s², rates per second. */
export interface CarTuning {
  maxForwardSpeed: number;
  maxReverseSpeed: number;
  acceleration: number;
  reverseAcceleration: number;
  brakeDeceleration: number;
  /** Deceleration applied when no pedal is pressed. */
  rollingFriction: number;
  /** Quadratic air drag: decel = dragCoefficient * speed². */
  dragCoefficient: number;
  /** How fast speed above the cap bleeds off (e.g. after a boost ends). */
  overspeedDeceleration: number;
  /** Below this forward speed, braking engages reverse instead. */
  reverseEngageSpeed: number;
  /** How quickly sideways sliding is cancelled. Higher = grippier. */
  lateralGrip: number;
  /** Yaw rate at full steering lock. */
  maxSteerRate: number;
  /** Speed at which full steering authority is reached (no turning on the spot). */
  fullSteerSpeed: number;
  /** Fraction of steering removed at top speed for stability. */
  highSpeedSteerReduction: number;
  /** How fast the applied steering follows the input (smooths digital buttons). */
  steeringResponse: number;
  boost: BoostTuning;
}

export interface BoostTuning {
  speedMultiplier: number;
  accelerationMultiplier: number;
  /** Energy is 0..1. */
  drainPerSecond: number;
  rechargePerSecond: number;
}

export const DEFAULT_CAR_TUNING: CarTuning = {
  maxForwardSpeed: 520,
  maxReverseSpeed: 160,
  acceleration: 430,
  reverseAcceleration: 260,
  brakeDeceleration: 950,
  rollingFriction: 160,
  dragCoefficient: 0.0004,
  overspeedDeceleration: 300,
  reverseEngageSpeed: 20,
  lateralGrip: 9,
  maxSteerRate: 3.3,
  fullSteerSpeed: 140,
  highSpeedSteerReduction: 0.35,
  steeringResponse: 12,
  boost: {
    speedMultiplier: 1.3,
    accelerationMultiplier: 1.6,
    drainPerSecond: 0.5,
    rechargePerSecond: 0.12,
  },
};
