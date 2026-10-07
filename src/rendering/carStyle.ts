import { CAR_COLORS } from "./RenderConstants";

/** Cosmetic choices beyond the paint colour. Indices into the option lists below. */
export interface CarStyle {
  accent: number;
  rims: number;
  calipers: number;
}

export interface StyleOption {
  label: string;
  /** `null` = same colour as the body paint. */
  color: string | null;
}

/** Secondary paint (sills, mirror caps, rear panel). */
export const ACCENT_OPTIONS: readonly StyleOption[] = [
  { label: "Black", color: "#121315" },
  { label: "Carbon", color: "#33373d" },
  { label: "White", color: "#e9eaec" },
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

export const DEFAULT_CAR_STYLE: CarStyle = { accent: 0, rims: 0, calipers: 0 };

/** Concrete colours for one car, as the renderer needs them. */
export interface CarLook {
  paint: string;
  accent: string;
  rims: string;
  calipers: string;
}

function pick(options: readonly StyleOption[], index: number, paint: string): string {
  return options[wrap(index, options.length)].color ?? paint;
}

function wrap(index: number, length: number): number {
  return ((Math.floor(index) % length) + length) % length;
}

export function resolveCarLook(paintIndex: number, style: CarStyle): CarLook {
  const paint = CAR_COLORS[wrap(paintIndex, CAR_COLORS.length)];
  return {
    paint,
    accent: pick(ACCENT_OPTIONS, style.accent, paint),
    rims: pick(RIM_OPTIONS, style.rims, paint),
    calipers: pick(CALIPER_OPTIONS, style.calipers, paint),
  };
}

/** For values from the network or storage: anything malformed falls back to the defaults. */
export function sanitizeCarStyle(value: unknown): CarStyle {
  if (typeof value !== "object" || value === null) return DEFAULT_CAR_STYLE;
  const { accent, rims, calipers } = value as Record<string, unknown>;
  const index = (v: unknown, options: readonly StyleOption[], fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? wrap(v, options.length) : fallback;
  return {
    accent: index(accent, ACCENT_OPTIONS, DEFAULT_CAR_STYLE.accent),
    rims: index(rims, RIM_OPTIONS, DEFAULT_CAR_STYLE.rims),
    calipers: index(calipers, CALIPER_OPTIONS, DEFAULT_CAR_STYLE.calipers),
  };
}
