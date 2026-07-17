import { useCallback, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { spacing, borderRadius } from "@/theme";

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: { active: IoniconsName; inactive: IoniconsName }[] = [
  { active: "home", inactive: "home-outline" },
  { active: "chatbubbles", inactive: "chatbubbles-outline" },
  { active: "storefront", inactive: "storefront-outline" },
  { active: "person", inactive: "person-outline" },
];

const TAB_LABELS = ["Feed", "Chats", "Marketplace", "Profile"];

const FALLBACK_BG = "#111111";
const FALLBACK_PRIMARY = "#6C47FF";
const FALLBACK_TEXT_SEC = "#9E9E9E";

export function CustomTabBar({ activeIndex, onTabPress }: {
  activeIndex: number;
  onTabPress: (index: number) => void;
}) {
  const theme = useTheme();
  const safeInsets = useSafeAreaInsets();
  const scaleAnims = useRef<Map<number, Animated.Value>>(new Map());

  const getScaleAnim = useCallback((key: number): Animated.Value => {
    if (!scaleAnims.current.has(key)) {
      scaleAnims.current.set(key, new Animated.Value(1));
    }
    return scaleAnims.current.get(key)!;
  }, []);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundSelected ?? FALLBACK_BG,
            borderColor: theme.border ?? "#2A2A2A",
            marginBottom: (safeInsets.bottom || spacing.sm) + spacing.sm,
            pointerEvents: "auto",
          },
        ]}
      >
        {TAB_ICONS.map((icon, index) => {
          const isFocused = activeIndex === index;
          const label = TAB_LABELS[index];
          const scaleAnim = getScaleAnim(index);

          const onPress = () => {
            onTabPress(index);
            scaleAnim.setValue(0.85);
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 4,
              tension: 200,
              useNativeDriver: Platform.OS !== "web",
            }).start();
          };

          return (
            <Pressable
              key={index}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
            >
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { transform: [{ scale: scaleAnim }] },
                ]}
              >
                {isFocused && (
                  <View
                    style={[
                      styles.glow,
                      { backgroundColor: theme.primary ?? FALLBACK_PRIMARY },
                    ]}
                  />
                )}
                <Ionicons
                  name={isFocused ? icon.active : icon.inactive}
                  size={24}
                  color={isFocused ? (theme.primary ?? FALLBACK_PRIMARY) : (theme.textSecondary ?? FALLBACK_TEXT_SEC)}
                />
              </Animated.View>
              {isFocused && (
                <ThemedText
                  style={[
                    styles.label,
                    { color: theme.primary ?? FALLBACK_PRIMARY },
                  ]}
                >
                  {label}
                </ThemedText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  container: {
    flexDirection: "row",
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    boxShadow: "0 6px 16px rgba(108, 71, 255, 0.25)",
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    minHeight: 48,
    minWidth: 48,
    gap: 2,
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    width: 40,
  },
  glow: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.12,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
  },
});
