import { Pressable, StyleSheet, type PressableProps, type ViewStyle, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { spacing, borderRadius, fontSize, fontWeight, shadows } from "@/theme";
import { useTheme } from "@/hooks/use-theme";

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
  const theme = useTheme();

  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.primary, ...shadows.small },
    secondary: { backgroundColor: theme.backgroundElement },
    ghost: { backgroundColor: theme.transparent },
    danger: { backgroundColor: theme.danger, ...shadows.small },
  };

  const textColor: Record<ButtonVariant, string> = {
    primary: theme.textOnDark,
    secondary: theme.text,
    ghost: theme.primary,
    danger: theme.textOnDark,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[`size_${size}`],
        variantStyles[variant],
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
          color={textColor[variant]}
        />
      ) : (
        <>
          {icon}
          <ThemedText
            style={[
              styles.text,
              styles[`text_${size}`],
              { color: textColor[variant] },
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
  text: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  text_sm: { fontSize: fontSize.sm },
  text_md: { fontSize: fontSize.md },
  text_lg: { fontSize: fontSize.lg },
});
