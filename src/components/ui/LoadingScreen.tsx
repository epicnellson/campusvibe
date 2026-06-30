import { View, StyleSheet, Animated, Platform } from "react-native";
import { useEffect, useRef } from "react";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius } from "@/theme";

function SkeletonBlock({ width = "100%", height = 16 }: { width?: number | string; height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, opacity },
      ]}
    />
  );
}

export function LoadingScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <SkeletonBlock width={120} height={24} />
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonBlock width={44} height={44} />
          <View style={styles.col}>
            <SkeletonBlock width={140} height={14} />
            <SkeletonBlock width={80} height={10} />
          </View>
        </View>
        <SkeletonBlock height={14} />
        <SkeletonBlock width="80%" height={14} />
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonBlock width={44} height={44} />
          <View style={styles.col}>
            <SkeletonBlock width={120} height={14} />
            <SkeletonBlock width={60} height={10} />
          </View>
        </View>
        <SkeletonBlock height={14} />
        <SkeletonBlock width="75%" height={14} />
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <SkeletonBlock width={44} height={44} />
          <View style={styles.col}>
            <SkeletonBlock width={160} height={14} />
            <SkeletonBlock width={100} height={10} />
          </View>
        </View>
        <SkeletonBlock height={14} />
        <SkeletonBlock height={14} />
        <SkeletonBlock width="60%" height={14} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  col: {
    flex: 1,
    gap: spacing.xs,
  },
  skeleton: {
    backgroundColor: "#2A2A2A",
    borderRadius: borderRadius.sm,
  },
});
