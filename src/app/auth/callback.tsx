import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { onAuthStateChanged } from "firebase/auth";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { completeEmailLinkSignIn } from "@/services/auth";
import { auth } from "@/services/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

function waitForAuth(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, () => {
      clearTimeout(timer);
      unsubscribe();
      resolve(!!auth.currentUser);
    });
  });
}

export default function AuthCallbackScreen() {
  const colors = useTheme();
  const params = useLocalSearchParams<{ code?: string; email?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done || error) return;

    const link = window.location.href;

    if (link && link.includes("apiKey=")) {
      AsyncStorage.getItem("firebase_email_for_link").then(async (storedEmail) => {
        const email = params.email || storedEmail;
        if (!email) {
          setError("Email not found. Please sign in again.");
          return;
        }
        try {
          await completeEmailLinkSignIn(email, link);
          await waitForAuth();
          setDone(true);
        } catch (e: any) {
          setError(e.message ?? "Authentication failed");
        }
      });
      return;
    }

    setTimeout(() => router.replace("/"), 100);
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    error: {
      color: colors.error,
      fontSize: 16,
    },
  });

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
