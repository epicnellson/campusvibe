import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button, type ButtonProps } from "@/components/ui/button";
import { spacing, fontSize, fontWeight } from "@/theme";

export type EmptyStateProps = {
  icon?: string;
  title: string;
  message?: string;
  action?: ButtonProps;
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <ThemedView style={styles.container}>
      {icon && <ThemedText style={styles.icon}>{icon}</ThemedText>}
      <ThemedText style={styles.title}>{title}</ThemedText>
      {message && (
        <ThemedText style={styles.message}>{message}</ThemedText>
      )}
      {action && (
        <Button title={action.title} variant={action.variant} onPress={action.onPress} style={styles.action} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 2,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    textAlign: "center",
    opacity: 0.6,
    lineHeight: 22,
  },
  action: {
    marginTop: spacing.lg,
  },
});
