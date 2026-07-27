import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spacing, fontSize, fontWeight } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { signUp, signInWithGoogle } from "@/services/auth";


const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  overlay: {
    ...(StyleSheet.absoluteFill as object),
    opacity: 0.03,
    backgroundColor: "#6C47FF",
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
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 34,
  },
  form: {
    gap: spacing.md,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#3A3A3A",
  },
  dividerText: {
    fontSize: fontSize.sm,
  },
  error: {
    color: "#FF3B30",
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
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  ageText: {
    fontSize: fontSize.sm,
    flexShrink: 1,
  },
  loginRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.sm,
  },
});

export default function SignupScreen() {
  const colors = useTheme();
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeAge, setAgreeAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const emailRef = useRef<TextInput>(null);

  const emailError =
    submitted && !email.trim()
      ? "Email is required"
      : submitted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? "Please enter a valid email address"
        : undefined;

  const passwordError =
    submitted && !password
      ? "Password is required"
      : submitted && password.length < 6
        ? "Password must be at least 6 characters"
        : undefined;

  const confirmError =
    submitted && password !== confirmPassword
      ? "Passwords do not match"
      : undefined;

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (e instanceof Error && e.message !== "Google sign-in was cancelled") {
        setError(e.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ width: 140, height: 24, borderRadius: 8, backgroundColor: colors.skeleton }} />
        <View style={{ width: 200, height: 14, borderRadius: 7, backgroundColor: colors.skeleton, marginTop: 12 }} />
        <View style={{ width: "80%", height: 48, borderRadius: 12, backgroundColor: colors.skeleton, marginTop: 24 }} />
      </View>
    );
  }
  if (session) return <Redirect href="/" />;

  const handleSignUp = async () => {
    setSubmitted(true);
    if (emailError || passwordError || confirmError) return;
    if (!agreeAge) {
      setError("You must be 16 or older to use CampusVibe");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await signUp(email.trim(), password);
      router.replace("/verify");
    } catch (e: any) {
      let msg = "Failed to create account";
      if (e.code === "auth/email-already-in-use") msg = "An account with this email already exists";
      else if (e.code === "auth/weak-password") msg = "Password is too weak";
      else if (e.code === "auth/invalid-email") msg = "Invalid email address";
      else if (e instanceof Error) msg = e.message;
      setError(msg);
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
              Sign up with your email to get started
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
            <Input
              placeholder="Password (6+ characters)"
              value={password}
              onChangeText={(t: string) => { setPassword(t); setError(null); }}
              secureTextEntry
              error={passwordError}
            />
            <Input
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(t: string) => { setConfirmPassword(t); setError(null); }}
              secureTextEntry
              error={confirmError}
            />

            <ThemedView style={styles.ageRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.checkbox,
                  { borderColor: colors.border },
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

            {error && (
              <ThemedText style={styles.error}>{error}</ThemedText>
            )}

            <Button
              title={sending ? "Creating account..." : "Create account"}
              onPress={handleSignUp}
              disabled={sending || !email.trim() || !password || !confirmPassword || !agreeAge}
              size="lg"
            />
          </ThemedView>

          <ThemedView style={styles.dividerRow}>
            <ThemedView style={styles.dividerLine} />
            <ThemedText themeColor="textTertiary" style={styles.dividerText}>or</ThemedText>
            <ThemedView style={styles.dividerLine} />
          </ThemedView>

          <Button
            title={googleLoading ? "Opening Google..." : "Continue with Google"}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            variant="secondary"
            size="lg"
          />

          <ThemedView style={styles.loginRow}>
            <ThemedText themeColor="textSecondary">
              Already have an account?{" "}
            </ThemedText>
            <Pressable onPress={() => router.push("/login")}>
              <ThemedText style={{ color: colors.primary, fontWeight: fontWeight.semibold }}>
                Sign in
              </ThemedText>
            </Pressable>
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
