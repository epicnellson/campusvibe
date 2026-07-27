import { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { spacing, fontSize, fontWeight } from "@/theme";

const PING_INTERVAL = 30_000;
const PING_URL = "https://www.google.com/favicon.ico";

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(PING_URL, { method: "HEAD", signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export function NetworkBanner() {
  const [online, setOnline] = useState(true);
  const [slideAnim] = useState(() => new Animated.Value(0));
  const colors = useTheme();
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window.addEventListener !== "function") return;
      const handleOnline = () => { wasOfflineRef.current = false; setOnline(true); };
      const handleOffline = () => { wasOfflineRef.current = true; setOnline(false); };
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    const interval = setInterval(async () => {
      const ok = await checkConnectivity();
      if (ok) {
        if (wasOfflineRef.current) wasOfflineRef.current = false;
        setOnline(true);
      } else {
        wasOfflineRef.current = true;
        setOnline(false);
      }
    }, PING_INTERVAL);

    checkConnectivity().then((ok) => {
      if (!ok) { wasOfflineRef.current = true; setOnline(false); }
    });

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: online ? 0 : 1,
      duration: 300,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [online, slideAnim]);

  if (online) return null;

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
      <ThemedView style={[styles.inner, { backgroundColor: colors.error }]}>
        <ThemedText style={[styles.text, { color: colors.textOnDark }]}>No internet connection</ThemedText>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "web" ? spacing.xl + spacing.sm : spacing.md,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
