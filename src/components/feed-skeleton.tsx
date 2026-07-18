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

function SkeletonPost({ hasImage = false }: { hasImage?: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <View style={styles.cardMeta}>
          <ShimmerBlock width="45%" height={12} />
          <ShimmerBlock width="25%" height={10} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <ShimmerBlock width="95%" height={13} />
        <ShimmerBlock width="70%" height={13} />
      </View>
      {hasImage && (
        <ShimmerBlock width="100%" height={180} borderRadius={12} />
      )}
      <View style={styles.cardActions}>
        <ShimmerBlock width={50} height={28} borderRadius={14} />
        <ShimmerBlock width={50} height={28} borderRadius={14} />
        <ShimmerBlock width={50} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

function SkeletonConfession() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.skeletonAvatarCircle}>
          <ShimmerBlock width={48} height={48} borderRadius={24} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <ShimmerBlock width="90%" height={13} />
        <ShimmerBlock width="60%" height={13} />
      </View>
      <View style={styles.cardActions}>
        <ShimmerBlock width={50} height={28} borderRadius={14} />
        <ShimmerBlock width={50} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

function SkeletonEvent() {
  return (
    <View style={styles.eventCard}>
      <ShimmerBlock width="100%" height={120} borderRadius={12} />
      <View style={styles.eventCardBody}>
        <ShimmerBlock width="40%" height={11} />
        <ShimmerBlock width="80%" height={15} />
        <ShimmerBlock width="60%" height={11} />
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonEvent />
      <SkeletonPost hasImage />
      <SkeletonPost />
      <SkeletonConfession />
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
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardMeta: {
    flex: 1,
    gap: 5,
  },
  cardBody: {
    marginTop: 10,
    gap: 7,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  skeletonAvatarCircle: {
    alignSelf: "center",
  },
  eventCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0A0A0A",
  },
  eventCardBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
});
