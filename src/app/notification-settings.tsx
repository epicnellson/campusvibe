import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SettingsSkeleton } from "@/components/feed-skeleton";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/notifications";
import type { NotificationPreferences } from "@/services/database.types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/hooks/use-theme";

const TOGGLES: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "likes",
    label: "Likes",
    description: "When someone likes your post",
  },
  {
    key: "messages",
    label: "Messages",
    description: "When someone sends you a message",
  },
  {
    key: "new_events",
    label: "New Events",
    description: "When a new event is posted",
  },
  {
    key: "popular_confessions",
    label: "Popular Confessions",
    description: "When your confession reaches 10+ likes",
  },
  {
    key: "follows",
    label: "New Followers",
    description: "When someone follows you",
  },
  {
    key: "comments",
    label: "Comments",
    description: "When someone comments on your post",
  },
  {
    key: "reposts",
    label: "Reposts",
    description: "When someone reposts your post",
  },
];


const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function NotificationSettingsScreen() {
  const colors = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotificationPreferences()
      .then((p) => {
        setPrefs(p);
        setLoading(false);
      })
      .catch((e) => {
        console.warn("Failed to load notification prefs:", e);
        setLoading(false);
      });
  }, []);

  const toggle = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await updateNotificationPreferences({ [key]: !prefs[key] });
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.backButton} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle}>
            Notification Settings
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.list}>
          {TOGGLES.map(({ key, label, description }) => (
            <ThemedView key={key} style={styles.row}>
              <ThemedView style={styles.rowInfo}>
                <ThemedText type="smallBold">{label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {description}
                </ThemedText>
              </ThemedView>
              <Switch
                value={prefs?.[key] ?? true}
                onValueChange={() => toggle(key)}
                trackColor={{ false: colors.mutedLight, true: colors.info }}
                thumbColor={colors.textOnDark}
              />
            </ThemedView>
          ))}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}
