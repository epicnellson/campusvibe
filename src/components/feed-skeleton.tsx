import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";

function ShimmerBlock({ width, height, borderRadius = 8 }: { width: number | `${number}%`; height: number; borderRadius?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "#333333",
        opacity,
      }}
    />
  );
}

function SkeletonPost() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <ShimmerBlock width={40} height={40} borderRadius={20} />
        <View style={styles.cardLines}>
          <ShimmerBlock width="60%" height={14} />
          <ShimmerBlock width="100%" height={14} />
          <ShimmerBlock width="80%" height={14} />
        </View>
      </View>
      <View style={styles.cardActions}>
        <ShimmerBlock width={60} height={20} borderRadius={10} />
        <ShimmerBlock width={60} height={20} borderRadius={10} />
        <ShimmerBlock width={40} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonPost />
      <SkeletonPost />
      <SkeletonPost />
      <SkeletonPost />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardLines: {
    flex: 1,
    gap: 8,
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
});
