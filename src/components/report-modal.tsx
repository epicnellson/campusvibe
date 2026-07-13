import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { REPORT_REASONS, submitReport } from "@/services/reports";

export type ReportModalProps = {
  visible: boolean;
  contentId: string;
  contentType: "post" | "confession" | "listing";
  onClose: () => void;
};

export function ReportModal({
  visible,
  contentId,
  contentType,
  onClose,
}: ReportModalProps) {
  const theme = useTheme();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await submitReport(contentId, contentType, selectedReason);
      setDone(true);
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDone(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <ThemedView style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.sheet}>
          {done ? (
            <>
              <ThemedText style={styles.thanks}>Report submitted</ThemedText>
              <ThemedText style={styles.thanksBody}>
                Thanks for helping keep CampusVibe safe. Our team will review this content.
              </ThemedText>
              <Pressable onPress={handleClose} style={[styles.submitButton, { backgroundColor: colors.primary }]} accessibilityRole="button">
                <ThemedText style={styles.submitButtonText}>Close</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Ionicons name="flag-outline" size={22} color={colors.primary} />
                <ThemedText style={styles.sheetTitle}>Report this Content</ThemedText>
              </View>
              <ThemedText style={styles.hint}>
                Why are you reporting this?
              </ThemedText>
              <ThemedView style={styles.reasons}>
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <Pressable
                      key={reason}
                      onPress={() => setSelectedReason(reason)}
                      style={({ pressed }) => [
                        styles.reasonButton,
                        {
                          backgroundColor: isSelected ? "rgba(108, 71, 255, 0.08)" : theme.backgroundSecondary,
                          borderColor: isSelected ? colors.primary : "transparent",
                          borderWidth: isSelected ? 1.5 : 0,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <ThemedText style={[styles.reasonText, isSelected && { color: colors.primary, fontWeight: "600" }]}>
                        {reason}
                      </ThemedText>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </ThemedView>
              <Pressable
                onPress={handleSubmit}
                disabled={!selectedReason || submitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: selectedReason ? colors.primary : theme.backgroundSelected,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !selectedReason || submitting }}
              >
                <ThemedText style={[styles.submitButtonText, !selectedReason && { opacity: 0.5 }]}>
                  {submitting ? "Submitting..." : "Submit Report"}
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleClose} style={styles.cancel} accessibilityRole="button">
                <ThemedText themeColor="textSecondary">Cancel</ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  hint: {
    fontSize: fontSize.sm,
  },
  reasons: {
    gap: spacing.sm,
  },
  reasonButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  reasonText: {
    fontSize: fontSize.md,
  },
  pressed: {
    opacity: 0.7,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: spacing.sm + 6,
    minHeight: 44,
    justifyContent: "center",
  },
  thanks: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  thanksBody: {
    textAlign: "center",
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  submitButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.md,
  },
});
