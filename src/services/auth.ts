import { supabase } from "@/services/supabase";
import { withRetry, getAuthErrorMessage } from "@/services/retry";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

export async function sendOTP(email: string) {
  return withRetry(async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  });
}

export async function verifyOTP(email: string, token: string) {
  return withRetry(async () => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error) throw error;
    } catch (err) {
      throw new Error(getAuthErrorMessage(err));
    }
  });
}

const GOOGLE_REDIRECT_URL = "campusvibe://auth/callback";

export async function signInWithGoogle() {
  const isWeb = Platform.OS === "web";
  const redirectTo = isWeb
    ? `${window.location.origin}/auth/callback`
    : GOOGLE_REDIRECT_URL;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      ...(isWeb ? {} : { skipBrowserRedirect: true }),
    },
  });
  if (error) throw error;

  if (isWeb) {
    // signInWithOAuth redirects the page on web — nothing more to do here
    return;
  }

  // Native: open browser, capture the redirect
  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    GOOGLE_REDIRECT_URL
  );

  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled");
  }

  // The redirect URL contains a Supabase auth code
  const url = new URL(result.url);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("No authorization code received");

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signOut() {
  return withRetry(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  });
}
