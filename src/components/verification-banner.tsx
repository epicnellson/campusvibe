import { Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";
import { router } from "expo-router";

type Props = {
  status: "pending" | "approved" | "rejected" | null;
};

export function VerificationBanner({ status }: Props) {
  const colors = useTheme();

  if (status === "approved") return null;

  const handlePress = () => {
    router.push("/verify-student-id" as any);
  };

  if (status === "rejected") {
    return (
      <Pressable onPress={handlePress} style={({ pressed }) => [styles.banner, styles.rejected, pressed && styles.pressed]}>
        <ThemedText style={styles.icon}>⚠️</ThemedText>
        <ThemedView style={styles.textContainer}>
          <ThemedText style={[styles.title, { color: colors.textOnDark }]}>Document rejected</ThemedText>
          <ThemedText style={[styles.message, { color: colors.mutedLight }]}>
            Your verification document was rejected. Tap to upload a new one.
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  if (status === "pending") {
    return (
      <ThemedView style={[styles.banner, { backgroundColor: colors.inputBg }]}>
        <ThemedText style={styles.icon}>⏳</ThemedText>
        <ThemedView style={styles.textContainer}>
          <ThemedText style={[styles.title, { color: colors.textOnDark }]}>Document pending review</ThemedText>
          <ThemedText style={[styles.message, { color: colors.mutedLight }]}>
            Your verification document is being reviewed. You can post once approved.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.banner, styles.required, pressed && styles.pressed]}>
      <ThemedText style={styles.icon}>🪪</ThemedText>
      <ThemedView style={styles.textContainer}>
        <ThemedText style={[styles.title, { color: colors.textOnDark }]}>Verify your student status</ThemedText>
        <ThemedText style={[styles.message, { color: colors.mutedLight }]}>
          Upload a student document to start posting. Tap here.
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pending: {
    backgroundColor: "#1A1A1A",
  },
  rejected: {
    backgroundColor: "#2A1515",
  },
  required: {
    backgroundColor: "#15152A",
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: "#FFFFFF",
  },
  message: {
    fontSize: fontSize.xs,
    color: "#AAAAAA",
    marginTop: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
