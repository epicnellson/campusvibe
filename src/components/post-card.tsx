import { memo, useCallback, useState, useRef } from "react";
import { Alert, Animated, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ResponsiveImage } from "@/components/responsive-image";
import { Avatar } from "@/components/ui/Avatar";
import { useSession } from "@/hooks/use-session";
import { likePost, unlikePost, deletePost } from "@/services/posts";
import { repostPost, unrepostPost } from "@/services/reposts";
import { setReaction, removeReaction, REACTION_EMOJIS, type ReactionEmoji } from "@/services/reactions";
import { resolveImageUrl } from "@/services/storage";
import type { PostWithProfile } from "@/services/database.types";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString();
}

function AnimatedActionButton({
  onPress,
  onLongPress,
  children,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  accessibilityRole?: any;
  accessibilityState?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.85,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.actionButton}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={{ transform: [{ scale }], flexDirection: "row", alignItems: "center", gap: 4 }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export type PostCardProps = {
  post: PostWithProfile;
  onLikeToggled?: (postId: string, liked: boolean) => void;
  onPostDeleted?: (postId: string) => void;
  repostedBy?: string;
  reactions?: { user_id: string; emoji: string }[];
  userReaction?: string | null;
  onReactionChanged?: (postId: string, emoji: string | null) => void;
  repostCount?: number;
  isReposted?: boolean;
  onRepostToggled?: (postId: string, reposted: boolean) => void;
  commentCount?: number;
};

function PostCardInner({
  post,
  onLikeToggled,
  onPostDeleted,
  repostedBy,
  reactions = [],
  userReaction = null,
  onReactionChanged,
  repostCount = 0,
  isReposted = false,
  onRepostToggled,
  commentCount = 0,
}: PostCardProps) {
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const userLiked = post.likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = post.likes?.length ?? 0;
  const [reportVisible, setReportVisible] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const authorName = post.profiles?.name ?? "Unknown";
  const department = post.profiles?.department ?? "";
  const isOwnPost = post.user_id === currentUserId;

  const handleLike = useCallback(async () => {
    try {
      if (userLiked) {
        await unlikePost(post.id);
      } else {
        await likePost(post.id);
      }
      onLikeToggled?.(post.id, !userLiked);
    } catch {}
  }, [post.id, userLiked, onLikeToggled]);

  const handleRepost = useCallback(async () => {
    if (isOwnPost) return;
    const wasReposted = isReposted;
    onRepostToggled?.(post.id, !wasReposted);
    try {
      if (wasReposted) {
        await unrepostPost(post.id);
      } else {
        await repostPost(post.id);
      }
    } catch {
      onRepostToggled?.(post.id, wasReposted);
    }
  }, [post.id, isOwnPost, isReposted, onRepostToggled]);

  const handleReaction = useCallback(async (emoji: ReactionEmoji) => {
    const wasReaction = userReaction;
    setShowReactionPicker(false);
    onReactionChanged?.(post.id, emoji);
    try {
      if (wasReaction === emoji) {
        await removeReaction(post.id);
        onReactionChanged?.(post.id, null);
      } else {
        await setReaction(post.id, emoji);
        onReactionChanged?.(post.id, emoji);
      }
    } catch {
      onReactionChanged?.(post.id, wasReaction);
    }
  }, [post.id, userReaction, onReactionChanged]);

  const handleLongPressReaction = useCallback(() => {
    if (!isOwnPost) {
      setShowReactionPicker(true);
    }
  }, [isOwnPost]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: post.content,
        url: `campusvibe://post/${post.id}`,
      });
    } catch {}
  }, [post]);

  const handleCopyText = useCallback(() => {
    Clipboard.setStringAsync(post.content);
  }, [post.content]);

  const handleLongPress = useCallback(() => {
    const actions: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      { text: "Like", onPress: handleLike },
      { text: "Share", onPress: handleShare },
      { text: "Copy Text", onPress: handleCopyText },
      { text: "Report", style: "destructive", onPress: () => setReportVisible(true) },
    ];
    if (isOwnPost) {
      actions.push({
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(post.id);
            onPostDeleted?.(post.id);
          } catch (e) {
            Alert.alert("Error", "Could not delete post. Please try again.");
          }
        },
      });
    }
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Post Actions", undefined, actions);
  }, [handleLike, handleShare, handleCopyText, isOwnPost, post.id, onPostDeleted]);

  const navigateToPost = useCallback(() => {
    router.push(`/post/${post.id}`);
  }, [post.id]);

  const resolvedImage = resolveImageUrl(post.image_url, "post-images");

  const reactionSummary = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      {repostedBy && (
        <View style={styles.repostBanner}>
          <Ionicons name="repeat-outline" size={14} color="#71717A" />
          <ThemedText style={styles.repostText}>Reposted by {repostedBy}</ThemedText>
        </View>
      )}

      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <Avatar name={authorName} uri={post.profiles?.avatar_url} size={40} />
        </View>

        <View style={styles.rightColumn}>
          <Pressable
            onPress={navigateToPost}
            onLongPress={handleLongPress}
            accessibilityLabel={`Post by ${authorName}`}
            accessibilityRole="link"
            style={styles.pressableContent}
          >
            <View style={styles.headerRow}>
              <ThemedText style={styles.authorName} numberOfLines={1}>
                {authorName}
              </ThemedText>
              {department ? (
                <ThemedText style={styles.department} numberOfLines={1}>
                  {department}
                </ThemedText>
              ) : null}
              <ThemedText style={styles.dot}>·</ThemedText>
              <ThemedText style={styles.timestamp}>
                {relativeTime(post.created_at)}
              </ThemedText>
            </View>

            <ThemedText style={styles.body}>{post.content}</ThemedText>

            {resolvedImage ? (
              <ResponsiveImage
                source={resolvedImage}
                borderRadius={14}
              />
            ) : null}
          </Pressable>

          {/* Reaction summary */}
          {Object.keys(reactionSummary).length > 0 && (
            <View style={styles.reactionSummary}>
              {Object.entries(reactionSummary).map(([emoji, count]) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReaction(emoji as ReactionEmoji)}
                  style={[
                    styles.reactionPill,
                    userReaction === emoji && styles.reactionPillActive,
                  ]}
                >
                  <ThemedText style={styles.reactionPillEmoji}>{emoji}</ThemedText>
                  {count > 1 && (
                    <ThemedText style={styles.reactionPillCount}>{count}</ThemedText>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Reaction picker */}
          {showReactionPicker && (
            <View style={styles.reactionPicker}>
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReaction(emoji)}
                  style={({ pressed }) => [
                    styles.reactionOption,
                    userReaction === emoji && styles.reactionOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText style={styles.reactionOptionEmoji}>{emoji}</ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowReactionPicker(false)}
                style={({ pressed }) => [styles.reactionOption, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={18} color="#71717A" />
              </Pressable>
            </View>
          )}

          <View style={styles.actionRow}>
            <AnimatedActionButton
              onPress={navigateToPost}
              accessibilityLabel="Comment"
            >
              <Ionicons name="chatbubble-outline" size={16} color="#71717A" />
              {commentCount > 0 && (
                <ThemedText style={styles.actionCount}>
                  {commentCount}
                </ThemedText>
              )}
            </AnimatedActionButton>

            {!isOwnPost && (
              <AnimatedActionButton
                onPress={handleRepost}
                accessibilityLabel={isReposted ? "Undo repost" : "Repost"}
                accessibilityState={{ selected: isReposted }}
              >
                <Ionicons
                  name="repeat-outline"
                  size={16}
                  color={isReposted ? "#22C55E" : "#71717A"}
                />
                {repostCount > 0 && (
                  <ThemedText
                    style={[styles.actionCount, { color: isReposted ? "#22C55E" : "#71717A" }]}
                  >
                    {repostCount}
                  </ThemedText>
                )}
              </AnimatedActionButton>
            )}

            <AnimatedActionButton
              onPress={handleLike}
              onLongPress={handleLongPressReaction}
              accessibilityLabel={userLiked ? "Unlike" : "Like"}
              accessibilityState={{ selected: userLiked }}
            >
              <Ionicons
                name={userLiked ? "heart" : "heart-outline"}
                size={16}
                color={userLiked ? "#E0245E" : "#71717A"}
              />
              {likeCount > 0 && (
                <ThemedText
                  style={[
                    styles.actionCount,
                    { color: userLiked ? "#E0245E" : "#71717A" },
                  ]}
                >
                  {likeCount}
                </ThemedText>
              )}
            </AnimatedActionButton>

            <AnimatedActionButton
              onPress={handleShare}
              accessibilityLabel="Share"
            >
              <Ionicons name="share-outline" size={16} color="#71717A" />
            </AnimatedActionButton>

            <View style={{ flex: 1 }} />

            <AnimatedActionButton
              onPress={() => setReportVisible(true)}
              accessibilityLabel="Report"
            >
              <Ionicons name="flag-outline" size={15} color="#71717A" />
            </AnimatedActionButton>
          </View>
        </View>
      </View>

      <ReportModal
        visible={reportVisible}
        contentId={post.id}
        contentType="post"
        onClose={() => setReportVisible(false)}
      />
    </View>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
    backgroundColor: "#000000",
  },
  repostBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingLeft: 52,
  },
  repostText: {
    fontSize: 12,
    color: "#71717A",
    fontWeight: "500",
  },
  contentRow: {
    flexDirection: "row",
  },
  leftColumn: {
    marginRight: 12,
    marginTop: 2,
    width: 40,
    alignItems: "center",
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  pressableContent: {
    flex: 1,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 6,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  department: {
    fontSize: 13,
    color: "#71717A",
  },
  dot: {
    fontSize: 14,
    color: "#3A3A3C",
  },
  timestamp: {
    fontSize: 13,
    color: "#71717A",
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: "#F0F0F0",
    marginTop: 4,
    width: "100%",
  },
  postImage: {
    width: "100%",
    minHeight: 200,
    borderRadius: 14,
    marginTop: 12,
    backgroundColor: "#0A0A0C",
  },
  reactionSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  reactionPillActive: {
    borderColor: "#6C47FF",
    backgroundColor: "rgba(108, 71, 255, 0.15)",
  },
  reactionPillEmoji: {
    fontSize: 14,
  },
  reactionPillCount: {
    fontSize: 12,
    color: "#71717A",
    fontWeight: "600",
  },
  reactionPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#1A1A1A",
    borderRadius: 28,
    alignSelf: "flex-start",
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
  },
  reactionOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionOptionActive: {
    backgroundColor: "rgba(108, 71, 255, 0.2)",
  },
  reactionOptionEmoji: {
    fontSize: 22,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingRight: 20,
    minHeight: 40,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.65,
  },
});
