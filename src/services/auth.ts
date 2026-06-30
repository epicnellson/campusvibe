import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { withRetry, getAuthErrorMessage } from "@/services/retry";

function getRedirectUrl(): string {
  if (Platform.OS === "web") {
    return `${window.location.origin}/auth/callback`;
  }
  // Native: use app scheme for deep linking
  return "campusvibe://auth/callback";
}

export async function sendOTP(email: string) {
  return withRetry(async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: getRedirectUrl(),
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

export async function signOut() {
  return withRetry(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  });
}
