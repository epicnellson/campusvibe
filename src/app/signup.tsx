import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spacing, fontSize, fontWeight, colors } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { sendOTP } from "@/services/auth";

export default function SignupScreen() {
  const theme = useTheme();
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState("");
  const [agreeAge, setAgreeAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const emailRef = useRef<TextInput>(null);

  const emailError =
    submitted && !email.trim()
      ? "Email is required"
      : submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? "Please enter a valid email address"
        : undefined;

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return null;
  if (session) return <Redirect href="/" />;

  const handleSendOTP = async () => {
    setSubmitted(true);
    if (emailError) return;
    if (!agreeAge) {
      setError("You must be 16 or older to use CampusVibe");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendOTP(email);
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>Create account</ThemedText>
            <ThemedText themeColor="textSecondary">
              Enter your email to get started
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <Input
              ref={emailRef}
              placeholder="you@example.com"
              value={email}
              onChangeText={(t: string) => { setEmail(t); setError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={emailError}
            />
            {error && (
              <ThemedText style={styles.error}>{error}</ThemedText>
            )}

            <ThemedView style={styles.ageRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.checkbox,
                  { borderColor: theme.border },
                  agreeAge && [styles.checkboxChecked, { backgroundColor: colors.primary, borderColor: colors.primary }],
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => { setAgreeAge(!agreeAge); setError(null); }}
              >
                {agreeAge && (
                  <ThemedText style={styles.checkmark}>✓</ThemedText>
                )}
              </Pressable>
              <Pressable
                onPress={() => { setAgreeAge(!agreeAge); setError(null); }}
              >
                <ThemedText style={styles.ageText} themeColor="textSecondary">
                  I confirm that I am 16 years or older
                </ThemedText>
              </Pressable>
            </ThemedView>

            <Button
              title={sending ? "Sending code..." : "Send verification code"}
              onPress={handleSendOTP}
              disabled={sending || !email.trim() || !agreeAge}
              size="lg"
            />
          </ThemedView>

          <Button
            title="Back to welcome"
            variant="ghost"
            onPress={() => router.replace("/")}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.03,
    backgroundColor: colors.primary,
  },
  safeArea: {
    flex: 1,
    maxWidth: 800,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  ageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {},
  checkmark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  ageText: {
    fontSize: fontSize.sm,
    flexShrink: 1,
  },
});
