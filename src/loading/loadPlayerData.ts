import { isIdTokenExpired, refreshGoogleTokens, type GoogleSessionCheck } from "@/account/googleAuth";
import {
  parseGoogleSession,
  parseProfile,
  toGoogleSession,
  type GoogleSession,
  type Profile,
} from "@/account/profile";
import { parseScoreBook, type ScoreBook } from "@/scores/scoreBook";
import type { GameSettings } from "@/settings/GameSettings";
import { parseSettings } from "@/settings/persistedSettings";
import { readJson, removeKey, STORAGE_KEYS, writeJson } from "@/storage/secureJson";

/** Past this, launch carries on with the saved Google session rather than wait for Google. */
const GOOGLE_CHECK_TIMEOUT_MS = 5000;

/** Everything saved on the device, validated. Never rejects: bad data becomes defaults. */
export interface PlayerData {
  profile: Profile | null;
  googleSession: GoogleSession | null;
  settings: GameSettings;
  scores: ScoreBook;
}

export async function loadPlayerData(): Promise<PlayerData> {
  const [profile, googleSession, settings, scores] = await Promise.all([
    readJson(STORAGE_KEYS.profile),
    readJson(STORAGE_KEYS.googleSession),
    readJson(STORAGE_KEYS.settings),
    readJson(STORAGE_KEYS.scores),
  ]);
  return {
    ...(await restoreGoogleSession(parseProfile(profile), parseGoogleSession(googleSession))),
    settings: parseSettings(settings),
    scores: parseScoreBook(scores),
  };
}

/**
 * A Google player whose ID token has expired gets fresh tokens, or is signed out if
 * Google has ended the session. If Google can't be reached, the saved session is kept.
 */
async function restoreGoogleSession(
  profile: Profile | null,
  googleSession: GoogleSession | null,
): Promise<Pick<PlayerData, "profile" | "googleSession">> {
  if (profile?.provider !== "google" || !isIdTokenExpired(googleSession?.idToken ?? null, Date.now())) {
    return { profile, googleSession };
  }
  const timeout = new Promise<GoogleSessionCheck>((resolve) =>
    setTimeout(() => resolve({ type: "unknown" }), GOOGLE_CHECK_TIMEOUT_MS),
  );
  const result = await Promise.race([refreshGoogleTokens(), timeout]);
  switch (result.type) {
    case "active": {
      const fresh = toGoogleSession(result.response.data);
      void writeJson(STORAGE_KEYS.googleSession, fresh);
      return { profile, googleSession: fresh };
    }
    case "signedOut":
      void removeKey(STORAGE_KEYS.profile);
      void removeKey(STORAGE_KEYS.googleSession);
      return { profile: null, googleSession: null };
    case "unknown":
      return { profile, googleSession };
  }
}
