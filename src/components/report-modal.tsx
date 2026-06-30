import { useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
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
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleReport = async (reason: string) => {
    setSubmitting(true);
    try {
      await submitReport(contentId, contentType, reason);
      setDone(true);
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <ThemedView style={styles.overlay}>
        <ThemedView type="backgroundElement" style={styles.sheet}>
          {done ? (
            <>
              <ThemedText style={styles.thanks}>Report submitted</ThemedText>
              <ThemedText style={styles.thanksBody}>
                Thanks for helping keep CampusVibe safe. Our team will review
                this content.
              </ThemedText>
              <Pressable onPress={handleClose} style={[styles.closeButton, { backgroundColor: colors.primary }]} accessibilityRole="button">
                <ThemedText style={styles.closeButtonText}>Close</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText style={styles.sheetTitle}>Report this content</ThemedText>
              <ThemedText style={styles.hint}>
                Why are you reporting this?
              </ThemedText>
              <ThemedView style={styles.reasons}>
                {REPORT_REASONS.map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => handleReport(reason)}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.reasonButton,
                      { backgroundColor: theme.backgroundSecondary },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitting }}
                  >
                    <ThemedText>{reason}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
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
  closeButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#ffffff",
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.md,
  },
});
