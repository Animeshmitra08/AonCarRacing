import * as SecureStore from "expo-secure-store";

/**
 * Small JSON values in the platform keychain/keystore (expo-secure-store).
 * Values should stay under `MAX_VALUE_BYTES` (see ./limits.ts).
 */
export const STORAGE_KEYS = {
  profile: "carracing.profile.v1",
  settings: "carracing.settings.v1",
  scores: "carracing.scores.v1",
} as const;

/** Reads and parses a value; `null` if missing, unreadable or not valid JSON. */
export async function readJson(key: string): Promise<unknown> {
  try {
    const text = await SecureStore.getItemAsync(key);
    return text === null ? null : (JSON.parse(text) as unknown);
  } catch (error) {
    console.warn(`Couldn't read "${key}" from secure storage.`, error);
    return null;
  }
}

/** Saves a value; failures are logged, never thrown (the game keeps working without storage). */
export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Couldn't save "${key}" to secure storage.`, error);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`Couldn't delete "${key}" from secure storage.`, error);
  }
}

/** Collapses rapid saves (e.g. typing a name) into one write after `delayMs` of quiet. */
export function createDebouncedWriter(key: string, delayMs: number): (value: unknown) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => void writeJson(key, value), delayMs);
  };
}
