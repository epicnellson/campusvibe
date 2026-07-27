import { memo, useCallback, useState, useRef } from "react";
import { Alert, Animated, Platform, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ResponsiveImage } from "@/components/responsive-image";
import { Avatar } from "@/components/ui/Avatar";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { likePost, unlikePost, deletePost } from "@/services/posts";
import { repostPost, unrepostPost } from "@/services/reposts";
import { setReaction, removeReaction, REACTION_EMOJIS, type ReactionEmoji } from "@/services/reactions";
import { resolveImageUrl } from "@/services/storage";
import type { PostWithProfile } from "@/services/database.types";
import { relativeTime } from "@/utils/date";

const actionBtnStyles = StyleSheet.create({
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingRight: 20,
    minHeight: 40,
  },
});

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
      style={actionBtnStyles.actionButton}
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
  const colors = useTheme();
  const currentUserId = session?.user?.id;
  const userLiked = post.likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = post.likes?.length ?? 0;
  const [reportVisible, setReportVisible] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [localComments, setLocalComments] = useState<string[]>([]);
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

  const handleSubmitComment = useCallback(() => {
    if (commentText.trim()) {
      setLocalComments((prev) => [...prev, commentText.trim()]);
      setCommentText("");
    }
  }, [commentText]);

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

  const navigateToProfile = useCallback(() => {
    if (post.user_id) {
      router.push(`/user/${post.user_id}` as any);
    }
  }, [post.user_id]);

  const resolvedImage = resolveImageUrl(post.image_url, "post-images");

  const reactionSummary = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.container, { borderBottomColor: colors.divider, backgroundColor: colors.background }]}>
      {repostedBy && (
        <View style={styles.repostBanner}>
          <Ionicons name="repeat-outline" size={14} color={colors.muted} />
          <ThemedText style={[styles.repostText, { color: colors.muted }]}>Reposted by {repostedBy}</ThemedText>
        </View>
      )}

      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <Pressable onPress={navigateToProfile} accessibilityLabel={`View ${authorName}'s profile`}>
            <Avatar name={authorName} uri={post.profiles?.avatar_url} size={40} />
          </Pressable>
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
              <Pressable onPress={navigateToProfile} accessibilityLabel={`View ${authorName}'s profile`}>
                <ThemedText style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                  {authorName}
                </ThemedText>
              </Pressable>
              {department ? (
                <ThemedText style={[styles.department, { color: colors.muted }]} numberOfLines={1}>
                  {department}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.dot, { color: colors.inputBorder }]}>·</ThemedText>
              <ThemedText style={[styles.timestamp, { color: colors.muted }]}>
                {relativeTime(post.created_at)}
              </ThemedText>
            </View>

            <ThemedText style={[styles.body, { color: colors.warmInverse }]}>{post.content}</ThemedText>

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
                    { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "transparent" },
                    userReaction === emoji && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                  ]}
                >
                  <ThemedText style={styles.reactionPillEmoji}>{emoji}</ThemedText>
                  {count > 1 && (
                    <ThemedText style={[styles.reactionPillCount, { color: colors.muted }]}>{count}</ThemedText>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Reaction picker */}
          {showReactionPicker && (
            <View style={[styles.reactionPicker, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReaction(emoji)}
                  style={({ pressed }) => [
                    styles.reactionOption,
                    userReaction === emoji && { backgroundColor: colors.primaryLight },
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
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          )}

          <View style={styles.actionRow}>
            <AnimatedActionButton
              onPress={() => setShowCommentBox((p) => !p)}
              accessibilityLabel="Comment"
            >
              <Ionicons name="chatbubble-outline" size={16} color={showCommentBox ? colors.primary : colors.muted} />
              {(commentCount + localComments.length) > 0 && (
                <ThemedText style={[styles.actionCount, { color: showCommentBox ? colors.primary : colors.muted }]}>
                  {commentCount + localComments.length}
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
                  color={isReposted ? "#22C55E" : colors.muted}
                />
                {repostCount > 0 && (
                  <ThemedText
                    style={[styles.actionCount, { color: isReposted ? "#22C55E" : colors.muted }]}
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
                color={userLiked ? colors.likeActive : colors.muted}
              />
              {likeCount > 0 && (
                <ThemedText
                  style={[
                    styles.actionCount,
                    { color: userLiked ? colors.likeActive : colors.muted },
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
              <Ionicons name="share-outline" size={16} color={colors.muted} />
            </AnimatedActionButton>

            <View style={{ flex: 1 }} />

            <AnimatedActionButton
              onPress={() => setReportVisible(true)}
              accessibilityLabel="Report"
            >
              <Ionicons name="flag-outline" size={15} color={colors.muted} />
            </AnimatedActionButton>
          </View>

          {showCommentBox && (
            <View style={styles.commentSection}>
              {localComments.map((c, i) => (
                <View key={i} style={[styles.commentBubble, { backgroundColor: colors.inputBg }]}>
                  <ThemedText style={[styles.commentText, { color: colors.text }]}>{c}</ThemedText>
                </View>
              ))}
              <View style={styles.commentInputRow}>
                <View style={[styles.commentInputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <TextInput
                    style={[styles.commentInput, { color: colors.text }]}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.muted}
                    value={commentText}
                    onChangeText={setCommentText}
                    onSubmitEditing={handleSubmitComment}
                    returnKeyType="send"
                  />
                </View>
                {commentText.trim() ? (
                  <Pressable
                    onPress={handleSubmitComment}
                    style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.6 }]}
                    accessibilityLabel="Send comment"
                  >
                    <Ionicons name="send" size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
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
  },
  department: {
    fontSize: 13,
  },
  dot: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 13,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 4,
    width: "100%",
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
    borderWidth: 1,
  },
  reactionPillEmoji: {
    fontSize: 14,
  },
  reactionPillCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  reactionPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 28,
    alignSelf: "flex-start",
    borderWidth: 0.5,
  },
  reactionOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
  actionCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  commentSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  commentBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: "88%",
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentInputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 38,
    justifyContent: "center",
  },
  commentInput: {
    fontSize: 14,
    paddingVertical: 0,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.65,
  },
});
