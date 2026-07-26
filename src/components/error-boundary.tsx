import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const colors = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.emoji}>!</ThemedText>
      <ThemedText style={styles.title}>Something went wrong</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {error?.message ?? "An unexpected error occurred"}
      </ThemedText>
      <Pressable
        onPress={onReset}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText style={[styles.buttonText, { color: colors.textOnDark }]}>Restart app</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("ErrorBoundary caught:", error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  message: {
    fontSize: fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  button: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.7,
  },
});
