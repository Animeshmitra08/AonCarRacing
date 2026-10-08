import { parseProfile, type Profile } from "@/account/profile";
import { parseScoreBook, type ScoreBook } from "@/scores/scoreBook";
import type { GameSettings } from "@/settings/GameSettings";
import { parseSettings } from "@/settings/persistedSettings";
import { readJson, STORAGE_KEYS } from "@/storage/secureJson";

/** Everything saved on the device, validated. Never rejects: bad data becomes defaults. */
export interface PlayerData {
  profile: Profile | null;
  settings: GameSettings;
  scores: ScoreBook;
}

export async function loadPlayerData(): Promise<PlayerData> {
  const [profile, settings, scores] = await Promise.all([
    readJson(STORAGE_KEYS.profile),
    readJson(STORAGE_KEYS.settings),
    readJson(STORAGE_KEYS.scores),
  ]);
  return { profile: parseProfile(profile), settings: parseSettings(settings), scores: parseScoreBook(scores) };
}
