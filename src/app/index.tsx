import { Redirect, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";

export default function WelcomeScreen() {
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading, error: profileError, refreshProfile } = useProfile();
  const colors = useTheme();

  const isLoading = sessionLoading || profileLoading;

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safe}>
          <Text style={[styles.title, { color: colors.textOnDark }]}>CampusVibe</Text>
          <ActivityIndicator size="small" color={colors.muted} style={styles.loader} />
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Text style={[styles.title, { color: colors.textOnDark }]}>CampusVibe</Text>
            <Text style={[styles.tagline, { color: colors.muted }]}>Your campus. Your community.</Text>
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary }, pressed && styles.pressed]}
              onPress={() => router.push("/signup")}
              accessibilityLabel="Sign up"
              accessibilityRole="button"
            >
              <Text style={[styles.primaryBtnText, { color: colors.textOnDark }]}>Get started</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, { borderColor: colors.border }, pressed && styles.pressed]}
              onPress={() => router.push("/login")}
              accessibilityLabel="Log in"
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>I already have an account</Text>
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
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
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
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
