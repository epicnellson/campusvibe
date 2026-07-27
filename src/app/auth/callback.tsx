import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { auth } from "@/services/firebase";

function waitForAuth(timeoutMs = 8000): Promise<boolean> {
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
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done || error) return;

    const hash = window.location.hash;
    if (hash && hash.includes("id_token")) {
      waitForAuth().then((ok) => {
        if (ok) setDone(true);
        else setError("Google sign-in failed. Please try again.");
      });
      return;
    }

    waitForAuth().then((ok) => {
      if (ok) setDone(true);
      else router.replace("/login");
    });
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

  if (done) return <Redirect href="/" />;

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.error}>{error}</ThemedText>
        <View style={{ marginTop: 16 }}>
          <ThemedText
            style={{ color: colors.primary }}
            onPress={() => router.replace("/login")}
          >
            Back to sign in
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText>Signing in...</ThemedText>
    </ThemedView>
  );
}
