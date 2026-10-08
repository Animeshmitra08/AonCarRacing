/** One per grid slot. */
export const CAR_COLORS = [
  "#e63946",
  "#1d8cf8",
  "#f4a261",
  "#8338ec",
  "#2a9d8f",
  "#ffbe0b",
  "#ff006e",
  "#adb5bd",
] as const;

/** 10 world units (px) = 1 m, so a 44-unit car is 4.4 m long. */
export const PX_PER_METER = 10;
export const METERS_PER_WORLD_UNIT = 1 / PX_PER_METER;
export const MPS_TO_KMH = 3.6;

export type GraphicsQuality = "performance" | "balanced" | "quality";

export interface GraphicsPreset {
  /** Fraction of native resolution the 3D view renders at (then scaled up). */
  renderScale: number;
  /** Fraction of trees/buildings kept (0..1). */
  sceneryDensity: number;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  performance: { renderScale: 0.5, sceneryDensity: 0.45 },
  balanced: { renderScale: 0.75, sceneryDensity: 0.75 },
  quality: { renderScale: 1, sceneryDensity: 1 },
};

/** Impact speeds (world units/s) mapped to camera shake 0..1. */
export const IMPACT_SHAKE = {
  minImpact: 120,
  fullImpact: 500,
} as const;
