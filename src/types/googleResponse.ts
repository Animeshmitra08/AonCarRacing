/** A successful Google sign-in, shaped like `GoogleSignin.signIn()`'s response. */
export interface GoogleResponse {
  data: {
    /** JWT proving who the user is. Expires about an hour after it's issued. */
    idToken: string | null;
    scopes: string[];
    /** Only set when `offlineAccess: true` is passed to `GoogleSignin.configure()`. */
    serverAuthCode: string | null;
    user: GoogleUser;
  };
  type: "success";
}

export interface GoogleUser {
  id: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string;
  /** Profile picture URL. */
  photo: string | null;
}
