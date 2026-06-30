import { useEffect, useRef } from "react";
import { Redirect, router } from "expo-router";
import { Animated, Platform, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, fontSize, fontWeight } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";

export default function WelcomeScreen() {
  const { session, isLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(actionsAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading || profileLoading) return null;

  if (session && profile) return <Redirect href="/(tabs)" />;
  if (session && !profile) return <Redirect href="/onboarding" />;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <ThemedText style={styles.brand}>CampusVibe</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Connect with your campus community
          </ThemedText>
        </Animated.View>

        <Animated.View
          style={[styles.actions, { opacity: actionsAnim, transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}
        >
          <Button
            title="Sign up with your email"
            variant="primary"
            size="lg"
            style={styles.button}
            onPress={() => router.push("/signup")}
          />
          <Button
            title="I already have an account"
            variant="secondary"
            size="lg"
            style={styles.button}
            onPress={() => router.push("/login")}
          />
          <Pressable onPress={() => router.push("/privacy")}>
            <ThemedText style={styles.privacy} themeColor="textSecondary">
              Privacy Policy
            </ThemedText>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl * 2,
    maxWidth: 800,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
  },
  brand: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    textAlign: "center",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: "center",
  },
  actions: {
    alignSelf: "stretch",
    gap: spacing.md,
  },
  button: {
    width: "100%",
  },
  privacy: {
    fontSize: fontSize.sm,
    textAlign: "center",
    textDecorationLine: "underline",
    padding: spacing.sm,
  },
});
