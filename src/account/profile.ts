import { MAX_NAME_LENGTH } from "@/network/constants";
import type { GoogleResponse, GoogleUser } from "@/types/googleResponse";

export type SignInProvider = "guest" | "google";

/** Who's playing. Only this (and settings/scores) is stored, on the device only. */
export interface Profile {
  name: string;
  provider: SignInProvider;
  createdAt: number;
  /** The Google account's details, when signed in with Google. */
  google?: GoogleUser;
}

/**
 * The Google sign-in's tokens. Stored apart from the profile: an ID token alone is
 * over 1 KB, and each secure-store value must stay small (see `@/storage/limits`).
 */
export type GoogleSession = Omit<GoogleResponse["data"], "user">;

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
  const { name, provider, createdAt, google } = value as Record<string, unknown>;
  if (typeof name !== "string" || (provider !== "guest" && provider !== "google")) return null;
  const googleUser = provider === "google" ? parseGoogleUser(google) : null;
  return {
    // Fully trimmed: a trailing space is only kept while the player is typing.
    name: cleanName(name).trim(),
    provider,
    createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : Date.now(),
    ...(googleUser && { google: googleUser }),
  };
}

export function toGoogleSession({ idToken, scopes, serverAuthCode }: GoogleResponse["data"]): GoogleSession {
  return { idToken, scopes, serverAuthCode };
}

export function parseGoogleSession(value: unknown): GoogleSession | null {
  if (typeof value !== "object" || value === null) return null;
  const { idToken, scopes, serverAuthCode } = value as Record<string, unknown>;
  return {
    idToken: stringOrNull(idToken),
    scopes: Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === "string") : [],
    serverAuthCode: stringOrNull(serverAuthCode),
  };
}

function parseGoogleUser(value: unknown): GoogleUser | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, name, givenName, familyName, email, photo } = value as Record<string, unknown>;
  if (typeof id !== "string" || typeof email !== "string") return null;
  return {
    id,
    email,
    name: stringOrNull(name),
    givenName: stringOrNull(givenName),
    familyName: stringOrNull(familyName),
    photo: stringOrNull(photo),
  };
}

const stringOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
