import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { SIDEBAR_WIDTH } from "@/constants/breakpoints";

type IoniconsName = keyof typeof Ionicons.glyphMap;

export type SidebarTab = {
  key: string;
  label: string;
  icon: IoniconsName;
  iconOutline: IoniconsName;
};

export const SIDEBAR_TABS: SidebarTab[] = [
  { key: "feed", label: "Feed", icon: "home", iconOutline: "home-outline" },
  { key: "chats", label: "Chats", icon: "chatbubbles", iconOutline: "chatbubbles-outline" },
  { key: "marketplace", label: "Marketplace", icon: "storefront", iconOutline: "storefront-outline" },
  { key: "search", label: "Search", icon: "search", iconOutline: "search-outline" },
  { key: "profile", label: "Profile", icon: "person", iconOutline: "person-outline" },
];

type Props = {
  activeTab: string;
  onTabPress: (key: string) => void;
};

function SidebarInner({ activeTab, onTabPress }: Props) {
  const colors = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: "#0A0A0A", borderRightColor: "#1E1E1E" }]}>
      <View style={styles.logoArea}>
        <ThemedText style={styles.logoText}>CampusVibe</ThemedText>
      </View>

      <View style={styles.tabs}>
        {SIDEBAR_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabPress(tab.key)}
              style={[
                styles.tabItem,
                isActive && { backgroundColor: "#1C1C1E" },
              ]}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={isActive ? tab.icon : tab.iconOutline}
                size={22}
                color={isActive ? colors.primary : "#71717A"}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : "#71717A" },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const WebSidebar = memo(SidebarInner);

const styles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    height: "100%",
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
  },
  logoArea: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E1E1E",
    marginBottom: 8,
  },
  logoText: {
    fontSize: 20,
    fontFamily: "Poppins_800ExtraBold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  tabs: {
    paddingHorizontal: 12,
    gap: 4,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
});
