import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, fontSize, fontWeight } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { auth } from "@/services/firebase";
import { resendVerification, signOut } from "@/services/auth";


const RESEND_DELAY = 60;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    maxWidth: 480,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 34,
    textAlign: "center",
  },
  instruction: {
    textAlign: "center",
    lineHeight: 22,
  },
  email: {
    fontWeight: fontWeight.semibold,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 36,
  },
  actions: {
    gap: spacing.md,
    alignItems: "center",
  },
  resendRow: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  resendTimer: {
    fontSize: fontSize.sm,
  },
});

export default function VerifyScreen() {
  const colors = useTheme();
  const { session, isLoading } = useSession();
  const [resendCooldown, setResendCooldown] = useState(RESEND_DELAY);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const email = session?.user?.email ?? auth.currentUser?.email ?? "";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerification();
      setResent(true);
      setResendCooldown(RESEND_DELAY);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  }, [resendCooldown, resending]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={{ width: 200, height: 14, borderRadius: 7, backgroundColor: colors.skeleton }} />
      </View>
    );
  }
  if (session) return <Redirect href="/" />;

  const handleRefresh = async () => {
    const fbUser = auth.currentUser;
    if (fbUser) {
      await fbUser.reload();
      if (fbUser.emailVerified) {
        router.replace("/(tabs)");
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <ThemedView style={styles.iconContainer}>
            <ThemedText style={styles.icon}>✉️</ThemedText>
          </ThemedView>

          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>Verify your email</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.instruction}>
              We sent a verification link to{" "}
              <ThemedText style={styles.email}>{email}</ThemedText>
            </ThemedText>
            <ThemedText themeColor="textTertiary" style={styles.instruction}>
              Click the link in the email, then come back and tap Continue.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.actions}>
            <Button
              title="Continue"
              onPress={handleRefresh}
              size="lg"
            />

            <ThemedView style={styles.resendRow}>
              {resendCooldown > 0 ? (
                <ThemedText style={styles.resendTimer} themeColor="textSecondary">
                  Resend email in {resendCooldown}s
                </ThemedText>
              ) : (
                <Button
                  title={resending ? "Sending..." : "Resend verification email"}
                  variant="ghost"
                  onPress={handleResend}
                  disabled={resending}
                />
              )}
            </ThemedView>

            {resent && (
              <ThemedText style={{ color: colors.primary, fontSize: fontSize.sm, textAlign: "center" }}>
                Verification email sent!
              </ThemedText>
            )}

            <Button
              title="Use a different email"
              variant="ghost"
              onPress={handleSignOut}
            />
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
