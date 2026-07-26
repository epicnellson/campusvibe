import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";

type TypingIndicatorProps = {
  name?: string;
  color?: string;
};

const USE_NATIVE = Platform.OS !== "web";

export function TypingIndicator({ name, color = "#71717A" }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: USE_NATIVE }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE }),
        ])
      );

    const composite = Animated.parallel([animate(dot1, 0), animate(dot2, 200), animate(dot3, 400)]);
    composite.start();
    return () => composite.stop();
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { backgroundColor: color, transform: [{ translateY: dot }] }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1C1C1E",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
