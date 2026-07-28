import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserPopupRedirectResolver,
  type User,
} from "firebase/auth";
import { auth } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export async function signUp(email: string, password: string) {
  return withRetry(async () => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    return credential.user;
  });
}

export async function signIn(email: string, password: string) {
  return withRetry(async () => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  });
}

export async function resendVerification() {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user");
  return withRetry(async () => {
    await sendEmailVerification(user);
  });
}

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildGoogleAuthUrl(redirectUri: string, nonce: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(nonce));
  const bytes = new Uint8Array(hashBuffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const hashedNonce = btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: hashedNonce,
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function signInWithGoogle() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google sign-in is not configured.");
  }

  if (Platform.OS === "web") {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (e: any) {
      if (e.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider).catch(() => {});
        return;
      }
      throw e;
    }
    return;
  }

  const redirectUri = "campusvibe://auth/callback";
  const nonce = generateNonce();
  const authUrl = await buildGoogleAuthUrl(redirectUri, nonce);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== "success" || !result.url) {
    throw new Error("Google sign-in was cancelled");
  }

  const url = new URL(result.url);
  const hashParams = new URLSearchParams(url.hash.substring(1));
  const idToken = hashParams.get("id_token");

  if (!idToken) {
    throw new Error("Failed to get Google credentials. Please try again.");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

export async function signOut() {
  return withRetry(async () => {
    await fbSignOut(auth);
  });
}
