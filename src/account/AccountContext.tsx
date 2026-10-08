import { createContext, use, useState, type ReactNode } from "react";

import { createDebouncedWriter, removeKey, STORAGE_KEYS, writeJson } from "@/storage/secureJson";
import type { GoogleResponse } from "@/types/googleResponse";

import { signOutOfGoogle } from "./googleAuth";
import { cleanName, toGoogleSession, type GoogleSession, type Profile } from "./profile";

const RENAME_SAVE_DELAY_MS = 400;
const saveRenamedProfile = createDebouncedWriter(STORAGE_KEYS.profile, RENAME_SAVE_DELAY_MS);

interface AccountContextValue {
  /** `null` = signed out (the login screen shows). */
  profile: Profile | null;
  /** The Google account and its tokens, when signed in with Google. */
  google: GoogleResponse | null;
  /** Pass the Google response to sign in with Google; leave it out for a guest. */
  signIn: (name: string, google?: GoogleResponse) => void;
  /** `revokeGoogle` also removes this app's access to the Google account. */
  signOut: (options?: { revokeGoogle?: boolean }) => void;
  rename: (name: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

interface AccountProviderProps {
  initial: Profile | null;
  initialGoogleSession: GoogleSession | null;
  children: ReactNode;
}

/** The signed-in profile, persisted with expo-secure-store. */
export function AccountProvider({ initial, initialGoogleSession, children }: AccountProviderProps) {
  const [profile, setProfile] = useState(initial);
  const [googleSession, setGoogleSession] = useState(initialGoogleSession);

  const google: GoogleResponse | null =
    profile?.provider === "google" && profile.google && googleSession
      ? { type: "success", data: { ...googleSession, user: profile.google } }
      : null;

  const saveGoogleSession = (data: GoogleResponse["data"]) => {
    const session = toGoogleSession(data);
    setGoogleSession(session);
    void writeJson(STORAGE_KEYS.googleSession, session);
  };

  const signIn = (name: string, googleResponse?: GoogleResponse) => {
    const next: Profile = {
      name: cleanName(name).trim(),
      provider: googleResponse ? "google" : "guest",
      createdAt: Date.now(),
      ...(googleResponse && { google: googleResponse.data.user }),
    };
    setProfile(next);
    void writeJson(STORAGE_KEYS.profile, next);
    if (googleResponse) saveGoogleSession(googleResponse.data);
  };

  const signOut = ({ revokeGoogle = false }: { revokeGoogle?: boolean } = {}) => {
    if (profile?.provider === "google") void signOutOfGoogle({ revoke: revokeGoogle });
    setProfile(null);
    setGoogleSession(null);
    void removeKey(STORAGE_KEYS.profile);
    void removeKey(STORAGE_KEYS.googleSession);
  };

  const rename = (name: string) => {
    if (!profile) return;
    const next = { ...profile, name: cleanName(name) };
    setProfile(next);
    // Debounced: typing a name shouldn't write to the keychain on every keystroke.
    saveRenamedProfile(next);
  };


  return (
    <AccountContext value={{ profile, google, signIn, signOut, rename }}>{children}</AccountContext>
  );
}

export function useAccount(): AccountContextValue {
  const context = use(AccountContext);
  if (!context) throw new Error("useAccount must be used inside <AccountProvider>.");
  return context;
}
