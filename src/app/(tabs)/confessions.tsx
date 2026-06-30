import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfessionCard } from "@/components/confession-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { spacing, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { fetchConfessions } from "@/services/confessions";
import { requireVerified } from "@/services/verification";
import type { ConfessionWithLikes } from "@/services/database.types";

const BOTTOM_TAB_INSET = 80;

export default function ConfessionsScreen() {
  const { session } = useSession();
  const { profile } = useProfile();
  const currentUserId = session?.user?.id;
  const [confessions, setConfessions] = useState<ConfessionWithLikes[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchConfessions();
      setConfessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load confessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const ITEM_HEIGHT = 240;

  const handleLikeToggled = useCallback((confessionId: string, liked: boolean) => {
    if (!currentUserId) return;
    setConfessions((prev) =>
      prev.map((c) => {
        if (c.id !== confessionId) return c;
        const updatedLikes = liked
          ? [...(c.confession_likes ?? []), { id: "", user_id: currentUserId! }]
          : (c.confession_likes ?? []).filter((l) => l.user_id !== currentUserId);
        return { ...c, confession_likes: updatedLikes };
      })
    );
  }, [currentUserId]);

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
        <ThemedView style={styles.headerBar}>
          <ThemedText style={styles.title}>Confessions</ThemedText>
          <Pressable
            onPress={() => {
              if (!requireVerified(profile)) return;
              router.push("/compose");
            }}
            style={({ pressed }) => [
              styles.composeButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText style={styles.composeButtonText}>+</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.warningBanner}>
          <ThemedText style={styles.warningIcon}>🛡️</ThemedText>
          <ThemedText style={styles.warningText}>
            Be kind. Harassment is not anonymous to admins.
          </ThemedText>
        </ThemedView>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : confessions.length === 0 ? (
          <ThemedView style={styles.center}>
            <ThemedText themeColor="textSecondary">
              No confessions yet. Share one anonymously!
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={confessions}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            renderItem={({ item }) => (
              <ConfessionCard confession={item} onLikeToggled={handleLikeToggled} />
            )}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
          />
        )}
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
    maxWidth: 800,
    width: "100%",
    paddingBottom: BOTTOM_TAB_INSET,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  composeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  composeButtonText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: fontWeight.semibold,
    lineHeight: 26,
  },
  pressed: {
    opacity: 0.7,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
  },
  warningIcon: {
    fontSize: 16,
  },
  warningText: {
    flex: 1,
    color: "#856404",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.error,
  },
});
