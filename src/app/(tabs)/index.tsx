import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { PostCard } from "@/components/post-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { spacing, borderRadius, fontSize, fontWeight, colors, shadows } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { fetchPosts } from "@/services/posts";
import type { PostWithProfile } from "@/services/database.types";

const BOTTOM_TAB_INSET = 80;
const PAGE_SIZE = 10;

export default function HomeFeedScreen() {
  const { session } = useSession();
  const { profile } = useProfile();
  const currentUserId = session?.user?.id;
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const allPostsRef = useRef<PostWithProfile[]>([]);
  const scaleAnims = useRef<Map<string, Animated.Value>>(new Map());
  const CACHE_KEY = "cached_feed";

  const getScaleAnim = (postId: string): Animated.Value => {
    if (!scaleAnims.current.has(postId)) {
      scaleAnims.current.set(postId, new Animated.Value(1));
    }
    return scaleAnims.current.get(postId)!;
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPosts();
      allPostsRef.current = data;
      setPosts(data.slice(0, PAGE_SIZE));
      setHasMore(data.length > PAGE_SIZE);
      setPage(1);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    } catch (e) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed: PostWithProfile[] = JSON.parse(cached);
          allPostsRef.current = parsed;
          setPosts(parsed.slice(0, PAGE_SIZE));
          setHasMore(parsed.length > PAGE_SIZE);
          setPage(1);
        } catch {}
      }
      setError(e instanceof Error ? e.message : "Failed to load posts");
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

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const allPosts = allPostsRef.current;
    const endIndex = nextPage * PAGE_SIZE;
    const newPosts = allPosts.slice(0, endIndex);
    setPosts(newPosts);
    setPage(nextPage);
    setHasMore(endIndex < allPosts.length);
    setLoadingMore(false);
  }, [hasMore, loadingMore, page]);

  const ITEM_HEIGHT = 200;

  const handleLikeToggled = useCallback((postId: string, liked: boolean) => {
    if (!currentUserId) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const updatedLikes = liked
          ? [...(p.likes ?? []), { id: "", user_id: currentUserId! }]
          : (p.likes ?? []).filter((l) => l.user_id !== currentUserId);
        return { ...p, likes: updatedLikes };
      })
    );
    const anim = getScaleAnim(postId);
    anim.setValue(1);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.3, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, []);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <ThemedView style={styles.footerLoader}>
        <ThemedText themeColor="textSecondary">Loading more...</ThemedText>
      </ThemedView>
    );
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
        <ThemedView style={styles.titleBar}>
          <ThemedText style={styles.title}>CampusVibe</ThemedText>
        </ThemedView>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            renderItem={({ item }) => (
              <Animated.View
                style={{ transform: [{ scale: getScaleAnim(item.id) }] }}
              >
                <PostCard
                  post={item}
                  onLikeToggled={handleLikeToggled}
                />
              </Animated.View>
            )}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListHeaderComponent={
              <ThemedView style={styles.quickActions}>
                <Pressable
                  onPress={() => router.push("/compose")}
                  style={({ pressed }) => [
                    styles.quickAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedView style={styles.quickIcon}>
                    <Ionicons name="create-outline" size={20} color="#FFF" />
                  </ThemedView>
                  <ThemedText style={styles.quickLabel}>Post</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(tabs)/confessions")}
                  style={({ pressed }) => [
                    styles.quickAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedView style={[styles.quickIcon, { backgroundColor: colors.warning }]}>
                    <Ionicons name="eye-off-outline" size={20} color="#FFF" />
                  </ThemedView>
                  <ThemedText style={styles.quickLabel}>Confess</ThemedText>
                </Pressable>
              </ThemedView>
            }
            ListEmptyComponent={
              <ThemedView style={styles.emptyState}>
                <ThemedText themeColor="textSecondary">
                  No posts yet. Be the first to share!
                </ThemedText>
              </ThemedView>
            }
          />
        )}
      </SafeAreaView>

      <Pressable
        style={styles.fab}
        onPress={() => router.push("/compose")}
      >
        <ThemedText style={styles.fabIcon}>+</ThemedText>
      </Pressable>
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
  titleBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
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
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundElement,
    minHeight: 44,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
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
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.md,
    bottom: BOTTOM_TAB_INSET + spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.large,
  },
  fabIcon: {
    fontSize: 28,
    color: "#FFF",
    lineHeight: 30,
    fontWeight: fontWeight.regular,
  },
});
