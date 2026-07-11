import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spacing, fontSize, fontWeight, colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { sendOTP } from "@/services/auth";

export default function LoginScreen() {
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
            <ThemedText style={styles.title}>Welcome back</ThemedText>
            <ThemedText themeColor="textSecondary">
              Enter your email to receive a login code
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
              keyboardType={showPassword ? "visible-password" : "email-address"}
              error={emailError}
              rightIcon={
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeToggle}>
                  <ThemedText style={styles.eyeIcon}>{showPassword ? "👁" : "👁‍🗨"}</ThemedText>
                </Pressable>
              }
            />
            {error && (
              <ThemedText style={styles.error}>{error}</ThemedText>
            )}
            <Button
              title={sending ? "Sending code..." : "Send login code"}
              onPress={handleSendOTP}
              disabled={sending || !email.trim()}
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
    ...(StyleSheet.absoluteFill as object),
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
    lineHeight: 34,
  },
  form: {
    gap: spacing.sm,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  eyeToggle: {
    padding: spacing.xs,
  },
  eyeIcon: {
    fontSize: 18,
  },
});
