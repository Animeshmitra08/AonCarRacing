import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
  type User,
} from "@react-native-google-signin/google-signin";

import type { GoogleResponse, GoogleUser } from "@/types/googleResponse";

/**
 * Replace with the real Web OAuth client ID from Google Cloud Console.
 * - Web client ID: used on Android to issue the ID token.
 * Android also needs an "Android" OAuth client registered with the app's package name
 * (com.aondigicon.carracing) and the signing certificate's SHA-1; that one isn't referenced here.
 *
 * iOS is not set up yet — add iosClientId here and the reversed client ID as `iosUrlScheme`
 * in app.json when iOS support is needed.
 */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

export type GoogleSignInResult =
  | { type: "success"; response: GoogleResponse }
  | { type: "cancelled" }
  | { type: "error"; message: string };

/** Shows the Google account picker and returns the chosen account and its tokens. */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    ensureConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { type: "cancelled" };
    return { type: "success", response: toGoogleResponse(response.data) };
  } catch (error) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
        case statusCodes.IN_PROGRESS:
          return { type: "cancelled" };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { type: "error", message: "Google Play Services is unavailable or out of date." };
      }
    }
    return { type: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

export type GoogleSessionCheck =
  /** Google still has the session: here are fresh tokens. */
  | { type: "active"; response: GoogleResponse }
  /** The session is gone (signed out elsewhere or access revoked). */
  | { type: "signedOut" }
  /** Couldn't tell (e.g. offline): keep the local session. */
  | { type: "unknown" };

/** Gets fresh tokens for the previously signed-in account, without any UI. */
export async function refreshGoogleTokens(): Promise<GoogleSessionCheck> {
  try {
    ensureConfigured();
    const response = await GoogleSignin.signInSilently();
    if (response.type === "noSavedCredentialFound") return { type: "signedOut" };
    return { type: "active", response: toGoogleResponse(response.data) };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) return { type: "signedOut" };
    return { type: "unknown" };
  }
}

/**
 * Ends the Google session: drops the cached access token, optionally revokes this app's
 * access to the account, then clears the account so the picker shows again next time.
 */
export async function signOutOfGoogle({ revoke = false }: { revoke?: boolean } = {}): Promise<void> {
  try {
    ensureConfigured();
    const { accessToken } = await GoogleSignin.getTokens();
    await GoogleSignin.clearCachedAccessToken(accessToken);
  } catch {
    // No live session tokens: nothing cached to clear.
  }
  try {
    if (revoke) await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google (or module unavailable): nothing to clear.
  }
}

export function googleDisplayName(user: GoogleUser): string {
  return user.givenName || user.name || user.email.split("@")[0];
}

export interface IdTokenClaims {
  issuedAt: number;
  expiresAt: number;
  emailVerified: boolean;
}

/**
 * Reads the ID token's claims (times in ms). For display only: the signature isn't
 * checked, so a server must verify the token before trusting it.
 */
export function readIdToken(idToken: string | null): IdTokenClaims | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const { iat, exp, email_verified } = JSON.parse(atob(padded)) as Record<string, unknown>;
    if (typeof iat !== "number" || typeof exp !== "number") return null;
    return { issuedAt: iat * 1000, expiresAt: exp * 1000, emailVerified: email_verified === true };
  } catch {
    return null;
  }
}

/** True if there's no usable ID token (missing, unreadable or past its expiry). */
export function isIdTokenExpired(idToken: string | null, now: number): boolean {
  const claims = readIdToken(idToken);
  return !claims || claims.expiresAt <= now;
}

function toGoogleResponse({ user, idToken, scopes, serverAuthCode }: User): GoogleResponse {
  return {
    type: "success",
    data: {
      idToken,
      scopes,
      serverAuthCode,
      user: {
        id: user.id,
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        email: user.email,
        photo: user.photo,
      },
    },
  };
}
