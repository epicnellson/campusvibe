import { View, StyleSheet, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { colors, fontSize, fontWeight, spacing, borderRadius } from "@/theme";

type BadgeVariant = "primary" | "success" | "warning" | "error" | "info" | "neutral";

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  style?: ViewStyle;
};

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: colors.primary + "20", text: colors.primaryLight },
  success: { bg: colors.success + "20", text: colors.successLight },
  warning: { bg: colors.warning + "20", text: colors.warningLight },
  error: { bg: colors.error + "20", text: colors.errorLight },
  info: { bg: colors.info + "20", text: colors.info },
  neutral: { bg: colors.backgroundElement, text: colors.textSecondary },
};

export function Badge({ label, variant = "neutral", size = "md", dot, style }: BadgeProps) {
  const vc = variantColors[variant];
  return (
    <View
      style={[
        styles.badge,
        styles[`size_${size}`],
        { backgroundColor: vc.bg },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: vc.text }]} />}
      <ThemedText style={[styles.label, styles[`label_${size}`], { color: vc.text }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  size_sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  size_md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: fontWeight.medium,
  },
  label_sm: {
    fontSize: fontSize.xs,
  },
  label_md: {
    fontSize: fontSize.sm,
  },
});
