import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { verifyOTP } from "@/services/auth";
import { getProfile } from "@/services/profile";

const DIGIT_COUNT = 6;
const RESEND_DELAY = 60;

export default function VerifyScreen() {
  const { session, isLoading } = useSession();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_DELAY);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setResendCooldown(RESEND_DELAY);
    const { sendOTP } = await import("@/services/auth");
    try {
      await sendOTP(email);
    } catch {
      // silently attempt resend
    }
  }, [email, resendCooldown]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  if (isLoading) return null;
  if (session) return <Redirect href="/" />;
  if (!email) return <Redirect href="/" />;

  const handleDigitChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length > 1) {
      const chars = cleaned.split("").slice(0, DIGIT_COUNT - index);
      const newDigits = [...digits];
      chars.forEach((ch, i) => { newDigits[index + i] = ch; });
      setDigits(newDigits);
      setError(null);
      const nextIndex = Math.min(index + chars.length, DIGIT_COUNT - 1);
      refs.current[nextIndex]?.focus();
      if (newDigits.every((d) => d !== "")) {
        handleVerify(newDigits.join(""));
      }
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    setDigits(newDigits);
    setError(null);

    if (cleaned && index < DIGIT_COUNT - 1) {
      refs.current[index + 1]?.focus();
    }

    if (cleaned && index === DIGIT_COUNT - 1 && newDigits.every((d) => d !== "")) {
      handleVerify(newDigits.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      refs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (token?: string) => {
    const code = token ?? digits.join("");
    if (code.length !== DIGIT_COUNT) {
      setError("Enter the full 6-digit code");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await verifyOTP(email, code);
      const profile = await getProfile();
      router.replace(profile ? "/(tabs)" : "/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
      setDigits(Array(DIGIT_COUNT).fill(""));
      refs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>Check your email</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.instruction}>
              Enter the 6-digit code sent to{" "}
              <ThemedText style={styles.email}>{email}</ThemedText>
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.digitRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(r) => { refs.current[index] = r; }}
                style={[
                  styles.digitBox,
                  focusedIndex === index && styles.digitBoxFocused,
                  digits[index] !== "" && styles.digitBoxFilled,
                ]}
                value={digit}
                onChangeText={(t) => handleDigitChange(t, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                onFocus={() => setFocusedIndex(index)}
                keyboardType="number-pad"
                maxLength={DIGIT_COUNT}
                selectTextOnFocus
              />
            ))}
          </ThemedView>

          {error && (
            <ThemedText style={styles.error}>{error}</ThemedText>
          )}

          <Button
            title={verifying ? "Verifying..." : "Verify"}
            onPress={() => handleVerify()}
            disabled={verifying || digits.some((d) => d === "")}
            size="lg"
          />

          <ThemedView style={styles.resendRow}>
            {resendCooldown > 0 ? (
              <ThemedText style={styles.resendTimer} themeColor="textSecondary">
                Resend code in {resendCooldown}s
              </ThemedText>
            ) : (
              <Button
                title="Resend code"
                variant="ghost"
                onPress={handleResend}
              />
            )}
          </ThemedView>

          <Button
            title="Back"
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
  safeArea: {
    flex: 1,
    maxWidth: 800,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  instruction: {
    textAlign: "center",
  },
  email: {
    fontWeight: fontWeight.semibold,
  },
  digitRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  digitBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 22,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    backgroundColor: colors.backgroundElement,
  },
  digitBoxFocused: {
    borderColor: colors.primary,
  },
  digitBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSelected,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: "center",
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
