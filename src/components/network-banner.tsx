import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, fontSize, fontWeight } from "@/theme";

export function NetworkBanner() {
  const [online, setOnline] = useState(true);
  const [slideAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window.addEventListener !== "function") return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: online ? 0 : 1,
      duration: 300,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [online, slideAnim]);

  if (Platform.OS !== "web" || online) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ThemedView style={styles.inner}>
        <ThemedText style={styles.text}>No internet connection</ThemedText>
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "#FF3B30",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + spacing.sm,
  },
  icon: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  text: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
