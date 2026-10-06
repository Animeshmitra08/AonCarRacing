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
