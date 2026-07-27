import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { ProfileSkeleton } from "@/components/feed-skeleton";
import { spacing } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { getProfileById, fetchUserPosts } from "@/services/profile";
import { resolveImageUrl } from "@/services/storage";
import { db_ops } from "@/services/db";
import { getOrCreateDMChannel } from "@/services/chats";
import { followUser, unfollowUser } from "@/services/follows";
import type { Profile, PostWithProfile, ListingWithSeller } from "@/services/database.types";
import { joinDate } from "@/utils/date";

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_PADDING = 2;
const AVATAR_SIZE = 88;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const { session } = useSession();
  const { width: screenWidth } = useWindowDimensions();
  const currentUserId = session?.user?.id;
  const TILE_SIZE = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = currentUserId === id;
  const isVerified = profile?.verification_status === "approved";

  const loadProfile = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getProfileById(id);
      setProfile(data);
    } catch (e) {
      console.warn("Failed to load profile:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadPosts = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchUserPosts(id);
      setPosts(data);
    } catch (e) {
      console.warn("Failed to load posts:", e);
    } finally {
      setPostsLoading(false);
    }
  }, [id]);

  const loadStats = useCallback(async () => {
    if (!id) return;
    try {
      const [followerData, followingData, followCheckData] = await Promise.all([
        db_ops.query("follows", {
          conditions: [{ field: "following_id", op: "==", value: id }],
        }),
        db_ops.query("follows", {
          conditions: [{ field: "follower_id", op: "==", value: id }],
        }),
        currentUserId && currentUserId !== id
          ? db_ops.query("follows", {
              conditions: [
                { field: "follower_id", op: "==", value: currentUserId },
                { field: "following_id", op: "==", value: id },
              ],
            })
          : Promise.resolve([]),
      ]);
      setFollowerCount(followerData.length);
      setFollowingCount(followingData.length);
      setIsFollowing(followCheckData.length > 0);
    } catch (e) {
      console.warn("Failed to load stats:", e);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    loadProfile();
    loadPosts();
    loadStats();
  }, [loadProfile, loadPosts, loadStats]);

  const handleFollow = useCallback(async () => {
    if (!currentUserId || !id || followLoading) return;
    const wasFollowing = isFollowing;
    setFollowLoading(true);
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => wasFollowing ? Math.max(0, c - 1) : c + 1);
    try {
      if (wasFollowing) {
        await unfollowUser(id);
      } else {
        await followUser(id);
      }
    } catch (e) {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => wasFollowing ? c + 1 : Math.max(0, c - 1));
      Alert.alert("Error", "Could not update follow status.");
    } finally {
      setFollowLoading(false);
    }
  }, [currentUserId, id, isFollowing, followLoading]);

  const handleShare = useCallback(() => {
    Share.share({ message: `Check out ${profile?.name ?? "this profile"} on CampusVibe!` });
  }, [profile?.name]);

  const handleMessage = useCallback(async () => {
    if (!id || !currentUserId || currentUserId === id) return;
    try {
      const channelId = await getOrCreateDMChannel(currentUserId, id);
      if (channelId) {
        router.push(`/chat/${channelId}`);
      }
    } catch (e) {
      console.warn("Failed to create DM from profile:", e);
      Alert.alert("Error", "Could not start conversation. Please try again.");
    }
  }, [id, currentUserId]);

  if (loading) {
    return (
      <ProfileSkeleton />
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText style={{ color: colors.muted }}>User not found</ThemedText>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ marginTop: 16 }}>
          <ThemedText style={{ color: colors.primary }}>Go Back</ThemedText>
        </Pressable>
      </View>
    );
  }

  const avatarUri = resolveImageUrl(profile.avatar_url, "profile-photos");

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>{profile.name}</ThemedText>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            accessibilityLabel="Share profile"
          >
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={avatarUri ?? undefined} name={profile.name ?? "?"} size={AVATAR_SIZE} />
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.nameRow}>
            <ThemedText style={styles.name}>{profile.name}</ThemedText>
            {isVerified && (
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{ marginLeft: 4 }} />
            )}
          </View>

          <ThemedText style={styles.metaText}>
            {[profile.department, profile.year].filter(Boolean).join(" · ")}
          </ThemedText>

          {profile.created_at && (
            <View style={styles.joinedRow}>
              <Ionicons name="calendar-outline" size={13} color="#71717A" />
              <ThemedText style={styles.joinedText}>{joinDate(profile.created_at)}</ThemedText>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{followingCount}</ThemedText>
              <ThemedText style={styles.statLabel}> Following</ThemedText>
            </View>
            <View style={styles.statDot} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{followerCount}</ThemedText>
              <ThemedText style={styles.statLabel}> Followers</ThemedText>
            </View>
            <View style={styles.statDot} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{posts.length}</ThemedText>
              <ThemedText style={styles.statLabel}> Posts</ThemedText>
            </View>
          </View>

          {/* Action buttons */}
          {!isOwnProfile && (
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleFollow}
                disabled={followLoading}
                style={({ pressed }) => [
                  styles.followBtn,
                  isFollowing && styles.followingBtn,
                  pressed && styles.pressed,
                ]}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                    {isFollowing ? "Following" : "Follow"}
                  </ThemedText>
                )}
              </Pressable>
              <Pressable
                onPress={handleMessage}
                style={({ pressed }) => [styles.messageBtn, pressed && styles.pressed]}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.messageBtnText}>Message</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Posts grid */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Posts</ThemedText>
        </View>
        {postsLoading ? (
          <View style={styles.tabEmpty}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.tabEmpty}>
            <Ionicons name="camera-outline" size={40} color={colors.border} />
            <ThemedText style={styles.emptyText}>No posts yet</ThemedText>
          </View>
        ) : (
          <View style={styles.mediaGrid}>
            {(() => {
              const rows: PostWithProfile[][] = [];
              for (let i = 0; i < posts.length; i += GRID_COLUMNS) {
                rows.push(posts.slice(i, i + GRID_COLUMNS));
              }
              return rows.map((row, ri) => (
                <View key={ri} style={styles.mediaRow}>
                  {row.map((post) => {
                    const img = resolveImageUrl(post.image_url, "post-images");
                    return (
                      <Pressable
                        key={post.id}
                        onPress={() => router.push(`/post/${post.id}`)}
                        style={({ pressed }) => [
                          { width: TILE_SIZE, height: TILE_SIZE, backgroundColor: "#0A0A0A", overflow: "hidden" as const },
                          pressed && styles.pressed,
                        ]}
                      >
                        {img ? (
                          <Image source={{ uri: img }} style={styles.tileImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.tileTextContainer}>
                            <ThemedText numberOfLines={4} style={styles.tileText}>
                              {post.content}
                            </ThemedText>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                  {row.length < GRID_COLUMNS &&
                    Array.from({ length: GRID_COLUMNS - row.length }).map((_, i) => (
                      <View key={`empty-${i}`} style={{ width: TILE_SIZE, height: TILE_SIZE, backgroundColor: "#0A0A0A" }} />
                    ))}
                </View>
              ));
            })()}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 4,
  },
  avatarWrapper: {
    position: "relative",
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    borderWidth: 3,
    borderColor: "#000000",
    overflow: "visible",
    marginBottom: 6,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  metaText: {
    fontSize: 14,
    color: "#71717A",
    marginTop: 2,
  },
  joinedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  joinedText: {
    fontSize: 13,
    color: "#71717A",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 14,
    color: "#71717A",
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#3A3A3A",
    marginHorizontal: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  followBtn: {
    height: 36,
    paddingHorizontal: 48,
    borderRadius: 18,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  followingBtnText: {
    color: "#FFFFFF",
  },
  messageBtn: {
    height: 36,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  messageBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E1E",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tabEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#3A3A3A",
  },
  mediaGrid: {
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  mediaRow: {
    flexDirection: "row",
    gap: GRID_GAP,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  tileTextContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 6,
    justifyContent: "center",
  },
  tileText: {
    fontSize: 11,
    lineHeight: 14,
    color: "#A0A0A0",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.65,
  },
});
