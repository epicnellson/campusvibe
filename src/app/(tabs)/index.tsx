import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PostCard } from "@/components/post-card";
import { ConfessionCard } from "@/components/confession-card";
import { EventCard } from "@/components/event-card";
import { ExternalFeedCard } from "@/components/external-feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { useSession } from "@/hooks/use-session";
import { useRefresh } from "@/hooks/use-refresh";
import { fetchPosts, fetchPostById } from "@/services/posts";
import { fetchConfessions, fetchConfessionById } from "@/services/confessions";
import { fetchUpcomingEvents } from "@/services/events";
import { fetchReactionsForPosts, type Reaction } from "@/services/reactions";
import { getUserRepostedPostIds, getRepostCount } from "@/services/reposts";
import { fetchCommentCounts } from "@/services/comments";
import { fetchExternalFeed, type ExternalFeedItem } from "@/services/feed-aggregator";
import { supabase } from "@/services/supabase";
import type { PostWithProfile, ConfessionWithLikes, EventWithRSVPs } from "@/services/database.types";

const BOTTOM_TAB_INSET = 80;

type FeedItem =
  | { type: "post"; data: PostWithProfile }
  | { type: "confession"; data: ConfessionWithLikes }
  | { type: "event"; data: EventWithRSVPs }
  | { type: "external"; data: ExternalFeedItem };

export default function HomeFeedScreen() {
  const { session } = useSession();
  const { feedKey } = useRefresh();
  const insets = useSafeAreaInsets();
  const currentUserId = session?.user?.id;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const [reactionsMap, setReactionsMap] = useState<Map<string, Reaction[]>>(new Map());
  const [repostedIds, setRepostedIds] = useState<Set<string>>(new Set());
  const [repostCounts, setRepostCounts] = useState<Map<string, number>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    try {
      setError(null);
      const [posts, confessions, events] = await Promise.all([
        fetchPosts(),
        fetchConfessions(),
        fetchUpcomingEvents(),
      ]);

      const postIds = posts.map((p) => p.id);
      const [reactionsData, userReposted, commentCountsData] = await Promise.all([
        fetchReactionsForPosts(postIds),
        currentUserId ? getUserRepostedPostIds(currentUserId) : Promise.resolve(new Set<string>()),
        fetchCommentCounts(postIds),
      ]);
      setReactionsMap(reactionsData);
      setRepostedIds(userReposted);
      setCommentCounts(commentCountsData);

      const counts = new Map<string, number>();
      await Promise.all(
        postIds.map(async (id) => {
          const c = await getRepostCount(id);
          if (c > 0) counts.set(id, c);
        })
      );
      setRepostCounts(counts);

      type UserFeedItem = { type: "post"; data: PostWithProfile } | { type: "confession"; data: ConfessionWithLikes } | { type: "event"; data: EventWithRSVPs };
      const userItems: UserFeedItem[] = [
        ...events.map((e) => ({ type: "event" as const, data: e })),
        ...posts.map((p) => ({ type: "post" as const, data: p })),
        ...confessions.map((c) => ({ type: "confession" as const, data: c })),
      ];
      userItems.sort((a, b) => {
        const da = new Date(a.data.created_at).getTime();
        const db = new Date(b.data.created_at).getTime();
        return db - da;
      });

      setItems(userItems as FeedItem[]);

      fetchExternalFeed(currentUserId).then((externalItems) => {
        if (externalItems.length === 0) return;
        const externalFeedItems: FeedItem[] = externalItems.map((e) => ({
          type: "external" as const,
          data: e,
        }));
        setItems((prev) => {
          const merged = [...prev];
          const insertPos = Math.min(3, merged.length);
          merged.splice(insertPos, 0, ...externalFeedItems);
          return merged;
        });
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => { load(); }, [feedKey]);

  // Realtime subscriptions — listen for new posts/confessions/events
  useEffect(() => {
    if (!currentUserId) return;

    const postChannel = supabase
      .channel("feed:posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const newPost = payload.new as { id: string };
        try {
          const full = await fetchPostById(newPost.id);
          setItems((prev) => {
            if (prev.some((i) => i.type === "post" && i.data.id === full.id)) return prev;
            return [{ type: "post", data: full }, ...prev];
          });
        } catch {}
      })
      .subscribe();

    const confessionChannel = supabase
      .channel("feed:confessions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "confessions" }, async (payload) => {
        const newConfession = payload.new as { id: string };
        try {
          const full = await fetchConfessionById(newConfession.id);
          setItems((prev) => {
            if (prev.some((i) => i.type === "confession" && i.data.id === full.id)) return prev;
            return [{ type: "confession", data: full }, ...prev];
          });
        } catch {}
      })
      .subscribe();

    const eventChannel = supabase
      .channel("feed:events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, async (payload) => {
        const newEvent = payload.new as { id: string };
        try {
          const { data } = await supabase
            .from("events")
            .select("id, title, description, date, time, location, image_url, created_at, user_id, event_rsvps(id, user_id)")
            .eq("id", newEvent.id)
            .single();
          if (data) {
            setItems((prev) => {
              if (prev.some((i) => i.type === "event" && i.data.id === data.id)) return prev;
              return [{ type: "event", data: data as unknown as EventWithRSVPs }, ...prev];
            });
          }
        } catch {}
      })
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(postChannel);
      supabase.removeChannel(confessionChannel);
      supabase.removeChannel(eventChannel);
    };
  }, [currentUserId]);

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

  const handlePostDeleted = useCallback((postId: string) => {
    setItems((prev) => prev.filter((item) => item.type !== "post" || item.data.id !== postId));
  }, []);

  const handleConfessionDeleted = useCallback((confessionId: string) => {
    setItems((prev) => prev.filter((item) => item.type !== "confession" || item.data.id !== confessionId));
  }, []);

  const handleReactionChanged = useCallback((postId: string, emoji: string | null) => {
    if (!currentUserId) return;
    setReactionsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(postId) ?? [];
      if (emoji === null) {
        next.set(postId, existing.filter((r) => r.user_id !== currentUserId));
      } else {
        const without = existing.filter((r) => r.user_id !== currentUserId);
        without.push({ id: "", user_id: currentUserId, post_id: postId, emoji, created_at: "" });
        next.set(postId, without);
      }
      return next;
    });
  }, [currentUserId]);

  const handleRepostToggled = useCallback((postId: string, reposted: boolean) => {
    if (!currentUserId) return;
    setRepostedIds((prev) => {
      const next = new Set(prev);
      if (reposted) next.add(postId);
      else next.delete(postId);
      return next;
    });
    setRepostCounts((prev) => {
      const next = new Map(prev);
      const current = next.get(postId) ?? 0;
      next.set(postId, reposted ? current + 1 : Math.max(0, current - 1));
      return next;
    });
  }, [currentUserId]);

  const renderItem = ({ item }: { item: FeedItem }) => {
    switch (item.type) {
      case "post":
        return (
          <PostCard
            post={item.data}
            onLikeToggled={handleLikeToggled}
            onPostDeleted={handlePostDeleted}
            reactions={reactionsMap.get(item.data.id) ?? []}
            userReaction={reactionsMap.get(item.data.id)?.find((r) => r.user_id === currentUserId)?.emoji ?? null}
            onReactionChanged={handleReactionChanged}
            repostCount={repostCounts.get(item.data.id) ?? 0}
            isReposted={repostedIds.has(item.data.id)}
            onRepostToggled={handleRepostToggled}
            commentCount={commentCounts.get(item.data.id) ?? 0}
          />
        );
      case "confession":
        return (
          <ConfessionCard confession={item.data} onLikeToggled={handleConfessionLikeToggled} onConfessionDeleted={handleConfessionDeleted} />
        );
      case "event":
        return <EventCard event={item.data} />;
      case "external":
        return <ExternalFeedCard item={item.data} />;
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
      <View style={styles.container}>
        <View style={[styles.safeArea, { paddingTop: insets.top }]}>
          <View style={styles.titleBar}>
            <Pressable
              onPress={() => router.push("/notifications")}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>CampusVibe</Text>
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={({ pressed }) => [styles.fabButton, pressed && styles.pressed]}
              accessibilityLabel="Create post"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <FeedSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.titleBar}>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>CampusVibe</Text>
          <Pressable
            onPress={() => setMenuVisible(true)}
            style={({ pressed }) => [
              styles.fabButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Create post"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Nothing here yet. Tap + to create something!
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => `${item.type}-${item.data.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={null}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={11}
            removeClippedSubviews={true}
            getItemLayout={undefined}
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
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Create</Text>
            <Pressable
              onPress={() => openCreator("post")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#6C47FF" }]}>
                <Ionicons name="create-outline" size={20} color="#FFF" />
              </View>
              <Text style={styles.menuLabel}>Post</Text>
              <Text style={styles.menuDesc}>Share something with everyone</Text>
            </Pressable>
            <Pressable
              onPress={() => openCreator("confession")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#FF9500" }]}>
                <Ionicons name="eye-off-outline" size={20} color="#FFF" />
              </View>
              <Text style={styles.menuLabel}>Confession</Text>
              <Text style={styles.menuDesc}>Post anonymously</Text>
            </Pressable>
            <Pressable
              onPress={() => openCreator("event")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <View style={[styles.menuIcon, { backgroundColor: "#1DB954" }]}>
                <Ionicons name="calendar-outline" size={20} color="#FFF" />
              </View>
              <Text style={styles.menuLabel}>Event</Text>
              <Text style={styles.menuDesc}>Create a campus event</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#000000",
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Poppins_800ExtraBold",
    letterSpacing: -0.5,
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fabButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 15,
    color: "#71717A",
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
    color: "#71717A",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    color: "#71717A",
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 56,
    gap: 8,
    backgroundColor: "#141414",
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#FFFFFF",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 12,
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
    fontSize: 15,
    fontWeight: "600",
    minWidth: 80,
    color: "#FFFFFF",
  },
  menuDesc: {
    fontSize: 13,
    flex: 1,
    color: "#71717A",
  },
});
