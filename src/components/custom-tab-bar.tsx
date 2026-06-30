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

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index: { active: "home", inactive: "home-outline" },
  events: { active: "calendar", inactive: "calendar-outline" },
  marketplace: { active: "storefront", inactive: "storefront-outline" },
  chats: { active: "chatbubbles", inactive: "chatbubbles-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const TAB_LABELS: Record<string, string> = {
  index: "Feed",
  events: "Events",
  marketplace: "Marketplace",
  chats: "Chats",
  profile: "Profile",
};

const BADGE_TABS = new Set(["index", "chats"]);

const FALLBACK_BG = "#111111";
const FALLBACK_PRIMARY = "#6C47FF";
const FALLBACK_TEXT_SEC = "#9E9E9E";
const FALLBACK_ERROR = "#FF3B30";
const FALLBACK_BORDER = "#2A2A2A";

export function CustomTabBar({ state, descriptors, navigation }: {
  state: { routes: { key: string; name: string }[]; index: number };
  descriptors: Record<string, { options: Record<string, any> }>;
  navigation: { emit: (event: any) => any; navigate: (name: string) => void };
}) {
  const theme = useTheme();
  const safeInsets = useSafeAreaInsets();
  const scaleAnims = useRef<Map<string, Animated.Value>>(new Map());

  const getScaleAnim = useCallback((key: string): Animated.Value => {
    if (!scaleAnims.current.has(key)) {
      scaleAnims.current.set(key, new Animated.Value(1));
    }
    return scaleAnims.current.get(key)!;
  }, []);

  const visible = state.routes.filter((r) => {
    const { options } = descriptors[r.key] ?? {};
    return options?.href !== null && !!TAB_ICONS[r.name];
  });

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundSelected ?? FALLBACK_BG,
            borderColor: theme.border ?? FALLBACK_BORDER,
            marginBottom: (safeInsets.bottom || spacing.sm) + spacing.sm,
          },
        ]}
      >
        {visible.map((route, index) => {
          const { options } = descriptors[route.key] ?? {};
          const isFocused = state.index === state.routes.indexOf(route);
          const icon = TAB_ICONS[route.name];
          const label = TAB_LABELS[route.name] ?? route.name;
          const showBadge = BADGE_TABS.has(route.name) && !!options?.tabBarBadge;
          const scaleAnim = getScaleAnim(route.key);

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
            scaleAnim.setValue(0.85);
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 4,
              tension: 200,
              useNativeDriver: Platform.OS !== "web",
            }).start();
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
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
                {showBadge && (
                  <View
                    style={[styles.badgeDot, { backgroundColor: theme.error ?? FALLBACK_ERROR }]}
                  />
                )}
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
    pointerEvents: "box-none",
  },
  container: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: "#6C47FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    minHeight: 48,
    minWidth: 48,
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
    opacity: 0.15,
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 1,
  },
});
