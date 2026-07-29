import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PostCard } from "@/components/post-card";
import { ConfessionCard } from "@/components/confession-card";
import { EventCard } from "@/components/event-card";
import { ExternalFeedCard } from "@/components/external-feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { useSession } from "@/hooks/use-session";
import { useRefresh } from "@/hooks/use-refresh";
import { useTheme } from "@/hooks/use-theme";
import { usePostInteractions } from "@/hooks/use-post-interactions";
import { fetchPostById } from "@/services/posts";
import { fetchConfessionById } from "@/services/confessions";
import { fetchReactionsForPosts, type Reaction } from "@/services/reactions";
import { getUserRepostedPostIds, getRepostCount } from "@/services/reposts";
import { fetchCommentCounts } from "@/services/comments";
import { createFeedComposer, type FeedItem as ComposerFeedItem } from "@/services/feed";
import { db } from "@/services/firebase";
import { db_ops } from "@/services/db";
import { collection, query, where, orderBy, limit as fbLimit, onSnapshot } from "firebase/firestore";
import type { PostWithProfile, ConfessionWithLikes, EventWithRSVPs } from "@/services/database.types";
import type { ExternalFeedItem } from "@/services/feed/types";

const BOTTOM_TAB_INSET = 80;

type FeedDisplayItem =
  | { type: "post"; data: PostWithProfile }
  | { type: "confession"; data: ConfessionWithLikes }
  | { type: "event"; data: EventWithRSVPs }
  | { type: "external"; data: ExternalFeedItem };

function toDisplayItem(item: ComposerFeedItem): FeedDisplayItem | null {
  const raw = item.meta?.rawRow as Record<string, any> | undefined;
  const table = item.meta?.rawTable as string | undefined;

  if (item.source === "campus" && raw && table === "posts") {
    return { type: "post", data: raw as unknown as PostWithProfile };
  }
  if (item.source === "campus" && raw && table === "confessions") {
    return { type: "confession", data: raw as unknown as ConfessionWithLikes };
  }
  if (item.source === "campus" && raw && table === "events") {
    return { type: "event", data: raw as unknown as EventWithRSVPs };
  }

  return {
    type: "external",
    data: {
      id: item.id,
      source: item.source as ExternalFeedItem["source"],
      type: item.type === "text" || item.type === "article" ? "article" : item.type as ExternalFeedItem["type"],
      title: item.content.title ?? "",
      description: item.content.body ?? undefined,
      image_url: item.media[0]?.url ?? item.media[0]?.thumbnailUrl ?? undefined,
      thumbnail_url: item.media[0]?.thumbnailUrl ?? undefined,
      link: item.urls.original ?? undefined,
      video_id: item.media[0]?.videoId ?? undefined,
      published_at: item.timestamps.publishedAt?.toISOString() ?? undefined,
      source_name: item.author.name ?? item.source,
      author: item.author.name,
    },
  };
}

function getItemId(item: FeedDisplayItem): string {
  if (item.type === "external") return item.data.id;
  return item.data.id;
}

function getPostId(item: FeedDisplayItem): string | null {
  if (item.type === "post") return item.data.id;
  return null;
}

export default function HomeFeedScreen() {
  const colors = useTheme();
  const { session } = useSession();
  const { feedKey } = useRefresh();
  const currentUserId = session?.user?.id;
  const [items, setItems] = useState<FeedDisplayItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [emptyLoadCount, setEmptyLoadCount] = useState(0);

  const {
    reactionsMap,
    repostedIds,
    repostCounts,
    commentCounts,
    toggleReaction: ctxToggleReaction,
    toggleRepost: ctxToggleRepost,
    setReactionsForPost,
    bulkSetReactions,
    bulkSetRepostedIds,
    bulkSetRepostCounts,
    bulkSetCommentCounts,
  } = usePostInteractions();

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50, minimumViewTime: 300 }).current;
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loadGenerationRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasInitiallyLoaded = useRef(false);
  const composerRef = useRef<ReturnType<typeof createFeedComposer> | null>(null);

  const getComposer = useCallback(() => {
    if (!currentUserId) return null;
    if (!composerRef.current) {
      composerRef.current = createFeedComposer(currentUserId);
    }
    return composerRef.current;
  }, [currentUserId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<FeedDisplayItem>[] }) => {
    if (!currentUserId) return;

    const visibleIds: string[] = [];
    let foundVideo: string | null = null;

    for (const vi of viewableItems) {
      if (!vi.item) continue;
      const id = getItemId(vi.item);
      visibleIds.push(id);

      if (vi.item.type === "external" && vi.item.data.type === "video" && vi.item.data.video_id) {
        foundVideo = vi.item.data.video_id;
      }
    }

    setActiveVideoId(foundVideo);

    const newIds = visibleIds.filter((id) => !seenIdsRef.current.has(id));
    if (newIds.length > 0) {
      for (const id of newIds) seenIdsRef.current.add(id);
      const composer = composerRef.current;
      if (composer) composer.touchItems(newIds);
    }
  }).current;

  const enrichCampusItems = useCallback(async (displayItems: FeedDisplayItem[]) => {
    if (!currentUserId) return;

    const postIds = displayItems
      .filter((i) => i.type === "post")
      .map((i) => i.data.id);

    if (postIds.length === 0) return;

    const [reactionsData, userReposted, commentCountsData] = await Promise.all([
      fetchReactionsForPosts(postIds),
      getUserRepostedPostIds(currentUserId),
      fetchCommentCounts(postIds),
    ]);

    bulkSetReactions(reactionsData);
    bulkSetRepostedIds(userReposted);
    bulkSetCommentCounts(commentCountsData);

    const counts = new Map<string, number>();
    await Promise.all(
      postIds.map(async (id) => {
        const c = await getRepostCount(id);
        if (c > 0) counts.set(id, c);
      })
    );
    bulkSetRepostCounts(counts);
  }, [currentUserId]);

  const load = useCallback(async (isRefresh = false) => {
    const gen = ++loadGenerationRef.current;
    const composer = getComposer();
    if (!composer) { setLoading(false); setRefreshing(false); return; }

    setEmptyLoadCount(0);
    setFeedHasMore(true);

    try {
      setError(null);

      const useIncremental = isRefresh && hasInitiallyLoaded.current;

      if (useIncremental) {
        const page = await composer.refresh();
        if (gen !== loadGenerationRef.current) return;

        const displayItems: FeedDisplayItem[] = [];
        for (const item of page.items) {
          const display = toDisplayItem(item);
          if (display) displayItems.push(display);
        }
        setItems((prev) => [...displayItems, ...prev]);
        setFeedHasMore(page.hasMore);
        await enrichCampusItems(displayItems);
      } else {
        const page = await composer.loadInitial((progressiveItems, hasMore) => {
          if (gen !== loadGenerationRef.current) return;
          const displayItems: FeedDisplayItem[] = [];
          for (const item of progressiveItems) {
            const display = toDisplayItem(item);
            if (display) displayItems.push(display);
          }
          setItems(displayItems);
          setFeedHasMore(hasMore);
          enrichCampusItems(displayItems);
        });
        if (gen !== loadGenerationRef.current) return;

        const displayItems: FeedDisplayItem[] = [];
        for (const item of page.items) {
          const display = toDisplayItem(item);
          if (display) displayItems.push(display);
        }
        setItems(displayItems);
        setFeedHasMore(page.hasMore);
        await enrichCampusItems(displayItems);
      }
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasInitiallyLoaded.current = true;
    }
  }, [getComposer, enrichCampusItems]);

  useEffect(() => { load(); }, [feedKey]);

  const loadMoreExternal = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const composer = getComposer();
    if (!composer) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const gen = loadGenerationRef.current;
      const page = await composer.loadMore();
      if (gen !== loadGenerationRef.current) return;

      if (page.items.length > 0) {
        const newDisplayItems: FeedDisplayItem[] = [];
        for (const item of page.items) {
          const display = toDisplayItem(item);
          if (display) newDisplayItems.push(display);
        }
        setItems((prev) => [...prev, ...newDisplayItems]);
        setEmptyLoadCount(0);
      } else {
        setEmptyLoadCount((prev) => {
          const next = prev + 1;
          if (next >= 3) setFeedHasMore(false);
          return next;
        });
      }
    } catch {
      setEmptyLoadCount((prev) => {
        const next = prev + 1;
        if (next >= 3) setFeedHasMore(false);
        return next;
      });
    }
    finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [getComposer]);

  const onEndReached = useCallback(() => {
    if (!loading && hasInitiallyLoaded.current && feedHasMore) {
      loadMoreExternal();
    }
  }, [loading, loadMoreExternal, feedHasMore]);

  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribes: (() => void)[] = [];

    const postsQuery = query(collection(db, "posts"), orderBy("created_at", "desc"), fbLimit(1));
    unsubscribes.push(
      onSnapshot(postsQuery, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const newPost = { id: change.doc.id, ...change.doc.data() } as { id: string };
            try {
              const full = await fetchPostById(newPost.id);
              setItems((prev) => {
                if (prev.some((i) => i.type === "post" && i.data.id === full.id)) return prev;
                return [{ type: "post", data: full }, ...prev];
              });
            } catch {}
          }
        }
      })
    );

    const confessionsQuery = query(collection(db, "confessions"), orderBy("created_at", "desc"), fbLimit(1));
    unsubscribes.push(
      onSnapshot(confessionsQuery, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const newConfession = { id: change.doc.id, ...change.doc.data() } as { id: string };
            try {
              const full = await fetchConfessionById(newConfession.id);
              setItems((prev) => {
                if (prev.some((i) => i.type === "confession" && i.data.id === full.id)) return prev;
                return [{ type: "confession", data: full }, ...prev];
              });
            } catch {}
          }
        }
      })
    );

    const today = new Date().toISOString().split("T")[0];
    const eventsQuery = query(
      collection(db, "events"),
      where("date", ">=", today),
      orderBy("date", "asc"),
      fbLimit(1)
    );
    unsubscribes.push(
      onSnapshot(eventsQuery, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const eventId = change.doc.id;
            try {
              const event = await db_ops.get("events", eventId);
              if (event) {
                const eventWithRSVPs = {
                  ...event,
                  event_rsvps: (event.rsvps ?? []).map((uid: string) => ({ user_id: uid })),
                };
                setItems((prev) => {
                  if (prev.some((i) => i.type === "event" && i.data.id === eventId)) return prev;
                  return [{ type: "event", data: eventWithRSVPs as unknown as EventWithRSVPs }, ...prev];
                });
              }
            } catch {}
          }
        }
      })
    );

    return () => {
      for (const unsub of unsubscribes) unsub();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const postIds = items
      .filter((i) => i.type === "post")
      .map((i) => i.data.id)
      .slice(0, 30);

    if (postIds.length === 0) return;

    const postsRef = collection(db, "posts");
    const q = query(postsRef, where("__name__", "in", postIds));

    const unsub = onSnapshot(q, (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== "modified") continue;
        const data = change.doc.data() as Record<string, any>;
        const updatedLikes = (data.likes ?? []).map((uid: string) => ({ user_id: uid }));
        setItems((prev) =>
          prev.map((item) => {
            if (item.type !== "post" || item.data.id !== change.doc.id) return item;
            return { ...item, data: { ...item.data, likes: updatedLikes } };
          })
        );
      }
    }, () => {});

    return () => unsub();
  }, [currentUserId, items.length]);

  useEffect(() => {
    if (!currentUserId) return;

    const postIds = items
      .filter((i) => i.type === "post")
      .map((i) => i.data.id)
      .slice(0, 30);

    if (postIds.length === 0) return;

    const reactionsRef = collection(db, "reactions");
    const q = query(reactionsRef, where("post_id", "in", postIds));

    const unsub = onSnapshot(q, (snapshot) => {
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;

      const affectedPostIds = new Set<string>();
      for (const change of changes) {
        const data = change.doc.data() as Record<string, any>;
        if (data.post_id) affectedPostIds.add(data.post_id);
      }

      for (const postId of affectedPostIds) {
        const postReactions = snapshot.docs
          .filter((d) => (d.data() as Record<string, any>).post_id === postId)
          .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) })) as Reaction[];

        setReactionsForPost(postId, postReactions);
      }
    }, () => {});

    return () => unsub();
  }, [currentUserId, items.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
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
    ctxToggleReaction(postId, currentUserId, emoji);
  }, [currentUserId, ctxToggleReaction]);

  const handleRepostToggled = useCallback((postId: string, reposted: boolean) => {
    if (!currentUserId) return;
    ctxToggleRepost(postId, currentUserId, reposted);
  }, [currentUserId, ctxToggleRepost]);

  const renderItem = useCallback(({ item }: { item: FeedDisplayItem }) => {
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
        return <ExternalFeedCard item={item.data} isActiveVideo={item.data.video_id ? item.data.video_id === activeVideoId : undefined} />;
    }
  }, [reactionsMap, repostedIds, repostCounts, commentCounts, currentUserId, activeVideoId, handleLikeToggled, handlePostDeleted, handleReactionChanged, handleRepostToggled, handleConfessionLikeToggled, handleConfessionDeleted]);

  const keyExtractor = useCallback((item: FeedDisplayItem) => `${item.type}-${getItemId(item)}`, []);

  const ListFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore, colors.primary]);

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
        <View style={styles.safeArea}>
          <View style={styles.titleBar}>
            <Pressable
              onPress={() => router.push("/notifications")}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textOnDark} />
            </Pressable>
            <Text style={styles.headerTitle}>CampusVibe</Text>
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={({ pressed }) => [styles.fabButton, pressed && styles.pressed]}
              accessibilityLabel="Create post"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={22} color={colors.textOnDark} />
            </Pressable>
          </View>
          <FeedSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        <View style={styles.titleBar}>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.pressed]}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textOnDark} />
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
            <Ionicons name="add" size={22} color={colors.textOnDark} />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={40} color="#555" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => { setError(null); setLoading(true); load(); }}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
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
            keyExtractor={keyExtractor}
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
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={ListFooter}
          />
        )}
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Create</Text>
            <Pressable
              onPress={() => openCreator("post")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="create-outline" size={20} color={colors.textOnDark} />
              </View>
              <Text style={styles.menuLabel}>Post</Text>
              <Text style={styles.menuDesc}>Share something with everyone</Text>
            </Pressable>
            <Pressable
              onPress={() => openCreator("confession")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.warning }]}>
                <Ionicons name="eye-off-outline" size={20} color={colors.textOnDark} />
              </View>
              <Text style={styles.menuLabel}>Confession</Text>
              <Text style={styles.menuDesc}>Post anonymously</Text>
            </Pressable>
            <Pressable
              onPress={() => openCreator("event")}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name="calendar-outline" size={20} color={colors.textOnDark} />
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
  errorText: {
    fontSize: 15,
    textAlign: "center",
    color: "#71717A",
    marginTop: 8,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6C47FF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
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
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 13,
    color: "#71717A",
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  menuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 56,
    gap: 8,
    backgroundColor: "#111111",
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
