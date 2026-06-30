import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { supabase } from "@/services/supabase";

export default function AuthCallbackScreen() {
  const { code, access_token, refresh_token } = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;

    // PKCE flow: exchange code for session
    if (code) {
      const doExchange = async () => {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setError(error.message);
            return;
          }
          setDone(true);
        } catch {
          setError("Authentication failed");
        }
      };
      doExchange();
      return;
    }

    // Implicit flow: tokens in URL fragment
    if (access_token && refresh_token) {
      const doSetSession = async () => {
        try {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            setError(error.message);
            return;
          }
          setDone(true);
        } catch {
          setError("Authentication failed");
        }
      };
      doSetSession();
      return;
    }

    // No auth params at all — nothing to handle
    setTimeout(() => router.replace("/"), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return <Redirect href="/" />;
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.error}>{error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText>Signing in...</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: "#ff4444",
    fontSize: 16,
  },
});
