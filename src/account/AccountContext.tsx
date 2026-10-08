import { createContext, use, useState, type ReactNode } from "react";

import { createDebouncedWriter, removeKey, STORAGE_KEYS, writeJson } from "@/storage/secureJson";

import { cleanName, type Profile, type SignInProvider } from "./profile";

const RENAME_SAVE_DELAY_MS = 400;
const saveRenamedProfile = createDebouncedWriter(STORAGE_KEYS.profile, RENAME_SAVE_DELAY_MS);

interface AccountContextValue {
  /** `null` = signed out (the login screen shows). */
  profile: Profile | null;
  signIn: (name: string, provider: SignInProvider) => void;
  signOut: () => void;
  rename: (name: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/** The signed-in profile, persisted with expo-secure-store. */
export function AccountProvider({ initial, children }: { initial: Profile | null; children: ReactNode }) {
  const [profile, setProfile] = useState(initial);

  const signIn = (name: string, provider: SignInProvider) => {
    const next: Profile = { name: cleanName(name).trim(), provider, createdAt: Date.now() };
    setProfile(next);
    void writeJson(STORAGE_KEYS.profile, next);
  };

  const signOut = () => {
    setProfile(null);
    void removeKey(STORAGE_KEYS.profile);
  };

  const rename = (name: string) => {
    if (!profile) return;
    const next = { ...profile, name: cleanName(name) };
    setProfile(next);
    // Debounced: typing a name shouldn't write to the keychain on every keystroke.
    saveRenamedProfile(next);
  };

  return <AccountContext value={{ profile, signIn, signOut, rename }}>{children}</AccountContext>;
}

export function useAccount(): AccountContextValue {
  const context = use(AccountContext);
  if (!context) throw new Error("useAccount must be used inside <AccountProvider>.");
  return context;
}
