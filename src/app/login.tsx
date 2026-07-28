import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View, ScrollView } from "react-native";
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
  safeArea: {
    flex: 1,
    maxWidth: 480,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl * 2,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#3A3A3A",
  },
  dividerText: {
    fontSize: fontSize.sm,
    color: "#8E8E93",
  },
  error: {
    color: "#FF453A",
    fontSize: fontSize.sm,
    lineHeight: 20,
    paddingVertical: spacing.xs,
  },
  eyeToggle: {
    padding: spacing.sm,
  },
  footlink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  footlinkText: {
    fontSize: fontSize.md,
  },
  footlinkAction: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: spacing.sm,
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
      if (e instanceof Error) {
        const msg = e.message;
        if (msg.includes("popup") || msg.includes("blocked")) {
          setError("Popup was blocked by your browser. Please allow popups for this site, or use email sign-in.");
        } else if (msg !== "Google sign-in was cancelled") {
          setError(msg);
        }
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
          <View style={{ width: 140, height: 24, borderRadius: 8, backgroundColor: colors.skeleton }} />
          <View style={{ width: 200, height: 14, borderRadius: 7, backgroundColor: colors.skeleton, marginTop: 12 }} />
          <View style={{ width: "60%", height: 48, borderRadius: 12, backgroundColor: colors.skeleton, marginTop: 24 }} />
        </View>
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
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ThemedView style={styles.header}>
              <ThemedText style={styles.title}>Welcome back</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
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
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={[styles.eyeToggle, { position: "absolute", right: 8, top: Platform.OS === "web" ? 14 : 10 }]}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <ThemedText style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁"}</ThemedText>
                </Pressable>
              </View>
              {error && (
                <ThemedView style={{ backgroundColor: "#3A0A0A", borderRadius: 8, padding: spacing.sm, marginTop: spacing.xs }}>
                  <ThemedText style={styles.error}>{error}</ThemedText>
                </ThemedView>
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
              <ThemedText style={styles.dividerText}>or</ThemedText>
              <ThemedView style={styles.dividerLine} />
            </ThemedView>

            <Button
              title={googleLoading ? "Opening Google..." : "Continue with Google"}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              variant="secondary"
              size="lg"
            />

            <ThemedView style={styles.footlink}>
              <ThemedText themeColor="textSecondary" style={styles.footlinkText}>
                Don't have an account?
              </ThemedText>
              <Pressable onPress={() => router.push("/signup")} hitSlop={8}>
                <ThemedText style={[styles.footlinkAction, { color: colors.primary }]}>
                  Sign up
                </ThemedText>
              </Pressable>
            </ThemedView>

            <Pressable
              onPress={() => router.replace("/")}
              hitSlop={8}
              style={{ alignItems: "center", paddingTop: spacing.md }}
            >
              <ThemedText themeColor="textTertiary" style={{ fontSize: fontSize.sm }}>
                Back to welcome
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
