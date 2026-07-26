import {
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink,
  signInWithCredential,
  signOut as fbSignOut,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

WebBrowser.maybeCompleteAuthSession();

const EMAIL_LINK_STORAGE_KEY = "firebase_email_for_link";

function getWebCallbackUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return "http://localhost:8081/auth/callback";
}

function getActionCodeSettings() {
  if (Platform.OS === "web") {
    return {
      handleCodeInApp: true,
      url: getWebCallbackUrl(),
    };
  }
  return {
    handleCodeInApp: true,
    url: "campusvibe://auth/callback",
    iOS: { bundleId: "com.campusvibe.app" },
    android: { packageName: "com.campusvibe.app", installApp: true, minimumVersion: "1" },
  };
}

export async function sendOTP(email: string) {
  return withRetry(async () => {
    await AsyncStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
    await sendSignInLinkToEmail(auth, email, getActionCodeSettings());
  });
}

export async function verifyOTP(email: string, _token: string) {
  return withRetry(async () => {
    const storedEmail = await AsyncStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    const targetEmail = storedEmail || email;
    await signInWithEmailLink(auth, targetEmail, window.location.href);
    await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  });
}

export async function completeEmailLinkSignIn(email: string, link: string) {
  await signInWithEmailLink(auth, email, link);
  await AsyncStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
}

export function isEmailLinkSignIn(url: string): boolean {
  try {
    return isSignInWithEmailLink(auth, url);
  } catch {
    return url.includes("apiKey=") && url.includes("mode=signIn");
  }
}

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function buildGoogleAuthUrl(redirectUri: string, nonce: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(nonce));
  const hashedNonce = base64urlencode(hashBuffer);

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
    throw new Error("Google sign-in is not configured. Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  }

  const redirectUri = Platform.OS === "web"
    ? `${window.location.origin}/auth/callback`
    : "campusvibe://auth/callback";

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
