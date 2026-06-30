import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/notifications";
import type { NotificationPreferences } from "@/services/database.types";
import { router } from "expo-router";

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
];

export default function NotificationSettingsScreen() {
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
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>{"<"}</ThemedText>
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
                trackColor={{ false: "#ccc", true: "#208AEF" }}
                thumbColor="#ffffff"
              />
            </ThemedView>
          ))}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

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
    backgroundColor: "#F0F0F3",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 20,
    fontWeight: "600",
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
