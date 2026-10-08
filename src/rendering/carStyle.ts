import { CAR_MODELS, carModelAt, type CarModelId } from "./carCatalog";
import { CAR_COLORS } from "./RenderConstants";

/** Everything about a car's look except the paint colour (which is `carColorIndex`). Indices into the lists below. */
export interface CarStyle {
  /** Index into CAR_MODELS. */
  model: number;
  accent: number;
  trim: number;
  rims: number;
  calipers: number;
  glass: number;
  lights: number;
}

export interface StyleOption {
  label: string;
  /** `null` = same colour as the body paint. */
  color: string | null;
}

/** Secondary paint: roof, mirror caps, side sills, rear wing. */
export const ACCENT_OPTIONS: readonly StyleOption[] = [
  { label: "Black", color: "#121315" },
  { label: "Carbon", color: "#33373d" },
  { label: "White", color: "#e9eaec" },
  { label: "Body", color: null },
];

/** Grille, bumpers' lower edges, diffuser and underbody. */
export const TRIM_OPTIONS: readonly StyleOption[] = [
  { label: "Black", color: "#0e0f10" },
  { label: "Graphite", color: "#3a3d42" },
  { label: "Chrome", color: "#c9ced6" },
  { label: "Body", color: null },
];

export const RIM_OPTIONS: readonly StyleOption[] = [
  { label: "Chrome", color: "#c9ced6" },
  { label: "Black", color: "#1d1e21" },
  { label: "Gold", color: "#c9a227" },
  { label: "Bronze", color: "#8a5a2c" },
];

export const CALIPER_OPTIONS: readonly StyleOption[] = [
  { label: "Red", color: "#c8102e" },
  { label: "Yellow", color: "#f2c200" },
  { label: "Blue", color: "#1d5fd1" },
  { label: "Black", color: "#1a1a1a" },
];

/** Window tint. */
export const GLASS_OPTIONS: readonly StyleOption[] = [
  { label: "Dark", color: "#0b121b" },
  { label: "Smoke", color: "#39414b" },
  { label: "Ocean", color: "#123b5e" },
  { label: "Bronze", color: "#4a3214" },
];

/** Headlight colour (tail lights stay red). */
export const LIGHT_OPTIONS: readonly StyleOption[] = [
  { label: "Xenon", color: "#eaf3ff" },
  { label: "Warm", color: "#ffe2a6" },
  { label: "Ice", color: "#8fd3ff" },
  { label: "Neon", color: "#7dff7a" },
];

export const DEFAULT_CAR_STYLE: CarStyle = { model: 0, accent: 0, trim: 0, rims: 0, calipers: 0, glass: 0, lights: 0 };

/** Concrete colours (and model) for one car, as the renderer needs them. */
export interface CarLook {
  model: CarModelId;
  paint: string;
  accent: string;
  trim: string;
  rims: string;
  calipers: string;
  glass: string;
  lights: string;
}

function wrap(index: number, length: number): number {
  return ((Math.floor(index) % length) + length) % length;
}

function pick(options: readonly StyleOption[], index: number, paint: string): string {
  return options[wrap(index, options.length)].color ?? paint;
}

export function resolveCarLook(paintIndex: number, style: CarStyle): CarLook {
  const paint = CAR_COLORS[wrap(paintIndex, CAR_COLORS.length)];
  return {
    model: carModelAt(style.model).id,
    paint,
    accent: pick(ACCENT_OPTIONS, style.accent, paint),
    trim: pick(TRIM_OPTIONS, style.trim, paint),
    rims: pick(RIM_OPTIONS, style.rims, paint),
    calipers: pick(CALIPER_OPTIONS, style.calipers, paint),
    glass: pick(GLASS_OPTIONS, style.glass, paint),
    lights: pick(LIGHT_OPTIONS, style.lights, paint),
  };
}

/** For values from the network or storage: anything malformed or missing falls back to the default. */
export function sanitizeCarStyle(value: unknown): CarStyle {
  if (typeof value !== "object" || value === null) return DEFAULT_CAR_STYLE;
  const v = value as Record<string, unknown>;
  const index = (x: unknown, length: number, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? wrap(x, length) : fallback;
  const d = DEFAULT_CAR_STYLE;
  return {
    model: index(v.model, CAR_MODELS.length, d.model),
    accent: index(v.accent, ACCENT_OPTIONS.length, d.accent),
    trim: index(v.trim, TRIM_OPTIONS.length, d.trim),
    rims: index(v.rims, RIM_OPTIONS.length, d.rims),
    calipers: index(v.calipers, CALIPER_OPTIONS.length, d.calipers),
    glass: index(v.glass, GLASS_OPTIONS.length, d.glass),
    lights: index(v.lights, LIGHT_OPTIONS.length, d.lights),
  };
}
