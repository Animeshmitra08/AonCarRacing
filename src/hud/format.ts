import { SIM_HZ } from "@/game/constants/PhysicsConstants";

/** m:ss.cc — a worklet so the UI thread can format the live race clock. */
export function formatRaceTime(seconds: number): string {
  "worklet";
  const totalCentis = Math.floor(seconds * 100);
  const minutes = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}.${centis < 10 ? "0" : ""}${centis}`;
}

export function formatTicks(ticks: number | null): string {
  return ticks === null ? "--:--.--" : formatRaceTime(ticks / SIM_HZ);
}

/** Compact lap time for split lists: "12.34", or "1:02.3" past a minute. */
export function formatLapTicks(ticks: number): string {
  const seconds = ticks / SIM_HZ;
  if (seconds < 60) return seconds.toFixed(2);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}

/** "+1.23s" gap behind the winner. */
export function formatGapTicks(ticks: number): string {
  return `+${(ticks / SIM_HZ).toFixed(2)}s`;
}
