import { MAX_NAME_LENGTH } from "@/network/constants";

export type SignInProvider = "guest" | "google";

/** Who's playing. Only this (and settings/scores) is stored, on the device only. */
export interface Profile {
  name: string;
  provider: SignInProvider;
  createdAt: number;
}

export const FALLBACK_NAME = "Player";

/** Trims, collapses spaces and caps the length. Empty stays empty (while typing). */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trimStart().slice(0, MAX_NAME_LENGTH);
}

/** The name to show others: never empty. */
export function displayName(profile: Profile | null): string {
  return profile?.name.trim() || FALLBACK_NAME;
}

export function randomGuestName(): string {
  return `Guest${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Validates a stored value; anything malformed means "not signed in". */
export function parseProfile(value: unknown): Profile | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, provider, createdAt } = value as Record<string, unknown>;
  if (typeof name !== "string" || (provider !== "guest" && provider !== "google")) return null;
  return {
    // Fully trimmed: a trailing space is only kept while the player is typing.
    name: cleanName(name).trim(),
    provider,
    createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}
