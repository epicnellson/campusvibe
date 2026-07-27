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
import { signIn, signInWithGoogle } from "@/services/auth";


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
    gap: spacing.sm,
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
  eyeToggle: {
    padding: spacing.xs,
  },
  eyeIcon: {
    fontSize: 18,
  },
  signupRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.sm,
  },
});

export default function LoginScreen() {
  const colors = useTheme();
  const { session, isLoading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSignIn = async () => {
    setSubmitted(true);
    if (emailError || passwordError) return;
    setError(null);
    setSending(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      let msg = "Failed to sign in";
      if (e.code === "auth/user-not-found") msg = "No account found with this email";
      else if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") msg = "Invalid email or password";
      else if (e.code === "auth/too-many-requests") msg = "Too many attempts. Try again later";
      else if (e.code === "auth/user-disabled") msg = "This account has been disabled";
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
            <ThemedText style={styles.title}>Welcome back</ThemedText>
            <ThemedText themeColor="textSecondary">
              Sign in with your email and password
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
            <View style={{ position: "relative" }}>
              <Input
                placeholder="Password"
                value={password}
                onChangeText={(t: string) => { setPassword(t); setError(null); }}
                secureTextEntry={!showPassword}
                error={passwordError}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={[styles.eyeToggle, { position: "absolute", right: 8, top: 10 }]}>
                <ThemedText style={styles.eyeIcon}>{showPassword ? "👁" : "👁‍🗨"}</ThemedText>
              </Pressable>
            </View>
            {error && (
              <ThemedText style={styles.error}>{error}</ThemedText>
            )}
            <Button
              title={sending ? "Signing in..." : "Sign in"}
              onPress={handleSignIn}
              disabled={sending || !email.trim() || !password}
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

          <ThemedView style={styles.signupRow}>
            <ThemedText themeColor="textSecondary">
              Don't have an account?{" "}
            </ThemedText>
            <Pressable onPress={() => router.push("/signup")}>
              <ThemedText style={{ color: colors.primary, fontWeight: fontWeight.semibold }}>
                Sign up
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
