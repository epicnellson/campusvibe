import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { PostCard } from "@/components/post-card";
import { ConfessionCard } from "@/components/confession-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { useRefresh } from "@/hooks/use-refresh";
import { fetchPosts } from "@/services/posts";
import { fetchConfessions } from "@/services/confessions";
import { fetchUpcomingEvents } from "@/services/events";
import type { PostWithProfile, ConfessionWithLikes, EventWithRSVPs } from "@/services/database.types";

const BOTTOM_TAB_INSET = 80;

type FeedItem =
  | { type: "post"; data: PostWithProfile }
  | { type: "confession"; data: ConfessionWithLikes }
  | { type: "event"; data: EventWithRSVPs };

export default function HomeFeedScreen() {
  const { session } = useSession();
  const { profile } = useProfile();
  const { feedKey } = useRefresh();
  const currentUserId = session?.user?.id;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const scaleAnims = useRef<Map<string, Animated.Value>>(new Map());

  const getScaleAnim = (id: string): Animated.Value => {
    if (!scaleAnims.current.has(id)) {
      scaleAnims.current.set(id, new Animated.Value(1));
    }
    return scaleAnims.current.get(id)!;
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const [posts, confessions, events] = await Promise.all([
        fetchPosts(),
        fetchConfessions(),
        fetchUpcomingEvents(),
      ]);
      const combined: FeedItem[] = [
        ...posts.map((p) => ({ type: "post" as const, data: p })),
        ...confessions.map((c) => ({ type: "confession" as const, data: c })),
        ...events.map((e) => ({ type: "event" as const, data: e })),
      ];
      combined.sort((a, b) => {
        const da = new Date(a.data.created_at).getTime();
        const db = new Date(b.data.created_at).getTime();
        return db - da;
      });
      setItems(combined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [feedKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleLikeToggled = useCallback((postId: string, liked: boolean) => {
    if (!currentUserId) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.type !== "post" || item.data.id !== postId) return item;
        const updatedLikes = liked
          ? [...(item.data.likes ?? []), { id: "", user_id: currentUserId! }]
          : (item.data.likes ?? []).filter((l) => l.user_id !== currentUserId);
        return { ...item, data: { ...item.data, likes: updatedLikes } };
      })
    );
    const anim = getScaleAnim(postId);
    anim.setValue(1);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.3, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [currentUserId]);

  const handleConfessionLikeToggled = useCallback((confessionId: string, liked: boolean) => {
    if (!currentUserId) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.type !== "confession" || item.data.id !== confessionId) return item;
        const updatedLikes = liked
          ? [...(item.data.confession_likes ?? []), { id: "", user_id: currentUserId! }]
          : (item.data.confession_likes ?? []).filter((l) => l.user_id !== currentUserId);
        return { ...item, data: { ...item.data, confession_likes: updatedLikes } };
      })
    );
  }, [currentUserId]);

  const renderItem = ({ item }: { item: FeedItem }) => {
    switch (item.type) {
      case "post":
        return (
          <Animated.View style={{ transform: [{ scale: getScaleAnim(item.data.id) }] }}>
            <PostCard post={item.data} onLikeToggled={handleLikeToggled} />
          </Animated.View>
        );
      case "confession":
        return (
          <ConfessionCard confession={item.data} onLikeToggled={handleConfessionLikeToggled} />
        );
      case "event":
        return <EventCard event={item.data} />;
    }
  };

  const openCreator = (mode: "post" | "confession" | "event") => {
    setMenuVisible(false);
    if (mode === "post") {
      router.push("/compose");
    } else if (mode === "confession") {
      router.push("/compose?mode=confession");
    } else {
      router.push("/create-event");
    }
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
      <View style={styles.safeArea}>
        <ThemedView style={styles.titleBar}>
          <ThemedText style={styles.title}>CampusVibe</ThemedText>
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={({ pressed }) => [
              styles.fabButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Create"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </ThemedView>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText themeColor="textSecondary">
              Nothing here yet. Tap + to create something!
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => `${item.type}-${item.data.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <ThemedView style={styles.menuSheet}>
            <ThemedText style={styles.menuTitle}>Create</ThemedText>
            <Pressable
              onPress={() => openCreator("post")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <ThemedView style={[styles.menuIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="create-outline" size={20} color="#FFF" />
              </ThemedView>
              <ThemedText style={styles.menuLabel}>Post</ThemedText>
              <ThemedText style={styles.menuDesc}>Share something with everyone</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => openCreator("confession")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <ThemedView style={[styles.menuIcon, { backgroundColor: colors.warning }]}>
                <Ionicons name="eye-off-outline" size={20} color="#FFF" />
              </ThemedView>
              <ThemedText style={styles.menuLabel}>Confession</ThemedText>
              <ThemedText style={styles.menuDesc}>Post anonymously</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => openCreator("event")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <ThemedView style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="calendar-outline" size={20} color="#FFF" />
              </ThemedView>
              <ThemedText style={styles.menuLabel}>Event</ThemedText>
              <ThemedText style={styles.menuDesc}>Create a campus event</ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function EventCard({ event }: { event: EventWithRSVPs }) {
  const date = new Date(event.date + "T00:00:00");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return (
    <Pressable
      onPress={() => router.push(`/create-event`)}
      style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
    >
      <ThemedView style={styles.eventDateBox}>
        <ThemedText style={styles.eventMonth}>{month}</ThemedText>
        <ThemedText style={styles.eventDay}>{day}</ThemedText>
      </ThemedView>
      <ThemedView style={styles.eventInfo}>
        <ThemedText style={styles.eventTitle} numberOfLines={1}>
          {event.title}
        </ThemedText>
        <ThemedText style={styles.eventMeta} numberOfLines={1}>
          {event.location} · {event.time ? event.time.slice(0, 5) : ""}
        </ThemedText>
        <ThemedText style={styles.eventRsvp}>
          {event.event_rsvps?.length ?? 0} going
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    lineHeight: 28,
  },
  fabButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg,
    gap: spacing.sm,
  },
  menuTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 56,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    minWidth: 80,
  },
  menuDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  eventCard: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundElement,
    gap: spacing.md,
    minHeight: 72,
  },
  eventDateBox: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  eventMonth: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
  },
  eventDay: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: fontWeight.bold,
  },
  eventInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  eventTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  eventMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  eventRsvp: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
