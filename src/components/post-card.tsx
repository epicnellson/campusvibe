import { memo, useCallback, useState, useRef } from "react";
import { Alert, Animated, Image, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { useSession } from "@/hooks/use-session";
import { likePost, unlikePost, deletePost } from "@/services/posts";
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
  children,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
}: {
  onPress: () => void;
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
};

function PostCardInner({ post, onLikeToggled, onPostDeleted }: PostCardProps) {
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const userLiked = post.likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = post.likes?.length ?? 0;
  const [reportVisible, setReportVisible] = useState(false);
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
        onPress: () => {
          Alert.alert("Delete post", "Are you sure you want to delete this post?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                try {
                  await deletePost(post.id);
                  onPostDeleted?.(post.id);
                } catch {}
              },
            },
          ]);
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

  return (
    <View style={styles.container}>
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
              <Image
                source={{ uri: resolvedImage }}
                style={styles.postImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>

          <View style={styles.actionRow}>
            <AnimatedActionButton
              onPress={navigateToPost}
              accessibilityLabel="Comment"
            >
              <Ionicons name="chatbubble-outline" size={16} color="#71717A" />
            </AnimatedActionButton>

            <AnimatedActionButton
              onPress={() => {}}
              accessibilityLabel="Repost"
            >
              <Ionicons name="repeat-outline" size={16} color="#71717A" />
            </AnimatedActionButton>

            <AnimatedActionButton
              onPress={handleLike}
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
  },
  postImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: "#0A0A0C",
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
});
