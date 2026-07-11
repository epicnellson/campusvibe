import { memo, useCallback, useState } from "react";
import { Alert, Image, Pressable, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { spacing, borderRadius, fontSize, colors } from "@/theme";
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
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(dateStr).toLocaleDateString();
}

export type PostCardProps = {
  post: PostWithProfile;
  onLikeToggled?: (postId: string, liked: boolean) => void;
};

function PostCardInner({ post, onLikeToggled }: PostCardProps) {
  const { session } = useSession();
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
      <View style={styles.card}>
        <View style={styles.header}>
          <Avatar
            name={authorName}
            size={44}
          />
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <ThemedText style={styles.authorName}>{authorName}</ThemedText>
              <ThemedText style={styles.dot}>·</ThemedText>
              <ThemedText style={styles.time}>{relativeTime(post.created_at)}</ThemedText>
            </View>
            {post.profiles?.department ? (
              <ThemedText style={styles.department}>{post.profiles.department}</ThemedText>
            ) : null}
          </View>
        </View>

        <ThemedText style={styles.content}>{post.content}</ThemedText>

        {post.image_url ? (
          <Image
            source={{ uri: post.image_url }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={handleLike}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel={userLiked ? "Unlike" : "Like"}
            accessibilityRole="button"
            accessibilityState={{ selected: userLiked }}
          >
            <Ionicons
              name={userLiked ? "heart" : "heart-outline"}
              size={20}
              color={userLiked ? colors.error : "#60646C"}
            />
            {likeCount > 0 && (
              <ThemedText
                style={[
                  styles.actionCount,
                  { color: userLiked ? colors.error : "#60646C" },
                ]}
              >
                {likeCount}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Reply"
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-outline" size={19} color="#60646C" />
          </Pressable>

          <Pressable
            onPress={() => setReportVisible(true)}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Report"
            accessibilityRole="button"
          >
            <Ionicons name="flag-outline" size={19} color="#60646C" />
          </Pressable>
        </View>
      </View>

      <ReportModal
        visible={reportVisible}
        contentId={post.id}
        contentType="post"
        onClose={() => setReportVisible(false)}
      />
    </Pressable>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    flex: 1,
    gap: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dot: {
    fontSize: 14,
    color: "#60646C",
  },
  time: {
    fontSize: 13,
    color: "#60646C",
  },
  department: {
    fontSize: 12,
    color: "#60646C",
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: "#E1E1E1",
    marginTop: spacing.xs + 2,
  },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.sm + 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 44,
    minWidth: 44,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.6,
  },
});
