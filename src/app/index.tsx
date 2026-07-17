import { Redirect, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";

export default function WelcomeScreen() {
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  const isLoading = sessionLoading || profileLoading;

  if (isLoading) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <Text style={styles.title}>CampusVibe</Text>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={styles.loader} />
        </SafeAreaView>
      </View>
    );
  }

  if (session && profile) {
    return <Redirect href="/(tabs)" />;
  }

  if (session && !profile) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Text style={styles.title}>CampusVibe</Text>
            <Text style={styles.tagline}>Your campus. Your community.</Text>
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => router.push("/signup")}
              accessibilityLabel="Sign up"
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Get started</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => router.push("/login")}
              accessibilityLabel="Log in"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>I already have an account</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 56,
  },
  brand: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
    color: "#71717A",
    fontSize: 15,
    fontWeight: "500",
  },
  loader: {
    marginTop: 16,
  },
  buttons: {
    gap: 12,
    width: "100%",
    maxWidth: 320,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#9E9E9E",
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
