import { Pressable, StyleSheet, type PressableProps, type ViewStyle, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = PressableProps & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style as ViewStyle,
      ]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#FFFFFF" : colors.primary}
        />
      ) : (
        <>
          {icon}
          <ThemedText
            style={[
              styles.text,
              styles[`text_${size}`],
              variant === "primary" && styles.textPrimary,
              variant === "danger" && styles.textDanger,
              variant === "secondary" && styles.textSecondary,
              variant === "ghost" && styles.textGhost,
              icon ? { marginLeft: spacing.sm } : undefined,
            ]}
          >
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  size_sm: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  size_md: {
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
  },
  size_lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  variant_primary: {
    backgroundColor: colors.primary,
    ...shadows.small,
  },
  variant_secondary: {
    backgroundColor: colors.backgroundElement,
  },
  variant_ghost: {
    backgroundColor: colors.transparent,
  },
  variant_danger: {
    backgroundColor: colors.error,
    ...shadows.small,
  },
  text: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  text_sm: { fontSize: fontSize.sm },
  text_md: { fontSize: fontSize.md },
  text_lg: { fontSize: fontSize.lg },
  textPrimary: { color: "#FFFFFF" },
  textDanger: { color: "#FFFFFF" },
  textSecondary: { color: colors.text },
  textGhost: { color: colors.primary },
});
