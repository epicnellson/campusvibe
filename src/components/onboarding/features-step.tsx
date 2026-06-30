import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, FadeInUp, FadeOut } from "react-native-reanimated";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";
import { useTheme } from "@/hooks/use-theme";

const FEATURES = [
  {
    emoji: "📝",
    title: "Feed",
    description: "Share updates, ask questions, and connect with your campus community.",
  },
  {
    emoji: "🤫",
    title: "Confessions",
    description: "Post anonymously and see what everyone else is thinking.",
  },
  {
    emoji: "📅",
    title: "Events",
    description: "Discover and RSVP to campus events happening around you.",
  },
];

export function FeaturesStep() {
  const theme = useTheme();
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = FEATURES.map((_, i) =>
      setTimeout(() => setVisibleCount(i + 1), i * 500)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>What you can do</ThemedText>
      <ThemedText themeColor="textSecondary">
        Here's what's waiting for you
      </ThemedText>

      <ThemedView style={styles.cards}>
        {FEATURES.slice(0, visibleCount).map((feature, i) => (
          <Animated.View
            key={feature.title}
            entering={FadeInUp.duration(400).easing(Easing.out(Easing.cubic))}
            exiting={FadeOut.duration(200)}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText style={styles.emoji}>{feature.emoji}</ThemedText>
            <ThemedView style={styles.cardText}>
              <ThemedText style={styles.cardTitle}>{feature.title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.cardDesc}>
                {feature.description}
              </ThemedText>
            </ThemedView>
          </Animated.View>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  cards: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  emoji: {
    fontSize: 40,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});
