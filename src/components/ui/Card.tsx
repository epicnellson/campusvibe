import { View, type ViewProps, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { spacing, borderRadius, shadows } from "@/theme";

export type CardProps = ViewProps & {
  padded?: boolean;
};

export function Card({ style, padded = true, children, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement },
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  padded: {
    padding: spacing.md,
  },
});
