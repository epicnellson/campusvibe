import { memo, useCallback, useState } from "react";
import { Alert, Pressable, Share, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Avatar } from "@/components/ui/Avatar";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { likePost, unlikePost } from "@/services/posts";
import type { PostWithProfile } from "@/services/database.types";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export type PostCardProps = {
  post: PostWithProfile;
  onLikeToggled?: (postId: string, liked: boolean) => void;
};

function PostCardInner({ post, onLikeToggled }: PostCardProps) {
  const { session } = useSession();
  const theme = useTheme();
  const currentUserId = session?.user?.id;
  const userLiked = post.likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = post.likes?.length ?? 0;
  const [reportVisible, setReportVisible] = useState(false);
  const authorName = post.profiles?.name ?? "Unknown";

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

  const handleLongPress = useCallback(() => {
    Alert.alert("Post Actions", undefined, [
      {
        text: "Like",
        onPress: handleLike,
      },
      {
        text: "Share",
        onPress: async () => {
          try {
            await Share.share({
              message: post.content,
              url: `campusvibe://post/${post.id}`,
            });
          } catch {}
        },
      },
      {
        text: "Copy Text",
        onPress: () => {
          Clipboard.setStringAsync(post.content);
        },
      },
      {
        text: "Report",
        style: "destructive",
        onPress: () => setReportVisible(true),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }, [post, handleLike]);

  return (
    <Pressable
      onLongPress={handleLongPress}
      accessibilityLabel={`Post by ${authorName}`}
      accessibilityRole="button"
    >
      <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedView style={styles.header}>
        <Avatar
          name={authorName}
          size={40}
        />
        <ThemedView style={styles.meta}>
          <ThemedText type="smallBold">
            {authorName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {post.profiles?.department ?? ""} · {relativeTime(post.created_at)}
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedText style={styles.content}>{post.content}</ThemedText>

      <ThemedView style={styles.actions}>
        <Pressable
          onPress={handleLike}
          style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]}
          accessibilityLabel={userLiked ? "Unlike this post" : "Like this post"}
          accessibilityRole="button"
          accessibilityState={{ selected: userLiked }}
        >
          <ThemedText style={userLiked ? styles.likedIcon : styles.likeIcon}>
            {userLiked ? "♥" : "♡"}
          </ThemedText>
          <ThemedText
            type="small"
            style={userLiked ? { color: colors.error } : undefined}
            themeColor={userLiked ? undefined : "textSecondary"}
          >
            {likeCount}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setReportVisible(true)}
          style={({ pressed }) => [pressed && styles.pressed, styles.reportButton]}
          accessibilityLabel="Report this post"
          accessibilityRole="button"
        >
          <ThemedText type="small" themeColor="textSecondary">
            Report
          </ThemedText>
        </Pressable>
      </ThemedView>

      <ReportModal
        visible={reportVisible}
        contentId={post.id}
        contentType="post"
        onClose={() => setReportVisible(false)}
      />
    </ThemedView>
    </Pressable>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    gap: 2,
  },
  content: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  reportButton: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  likeIcon: {
    fontSize: 18,
    color: "#60646C",
  },
  likedIcon: {
    fontSize: 18,
    color: colors.error,
  },
});
