import { memo, useCallback, useRef, useState } from "react";
import { Animated, Platform, Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { ResponsiveImage } from "@/components/responsive-image";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/hooks/use-theme";
import type { ExternalFeedItem } from "@/services/feed/types";

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const ts = new Date(dateStr).getTime();
  if (!ts || ts < 86400000) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

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
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
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
      style={actionBtnStyles.actionButton}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={{ transform: [{ scale }], flexDirection: "row", alignItems: "center", gap: 4 }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export const ExternalFeedCard = memo(function ExternalFeedCard({
  item,
  isActiveVideo,
}: {
  item: ExternalFeedItem;
  isActiveVideo?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const colors = useTheme();

  const handleLike = useCallback(() => {
    setLiked((p) => {
      setLikeCount((c) => p ? Math.max(0, c - 1) : c + 1);
      return !p;
    });
  }, []);

  const handleSubmitComment = useCallback(() => {
    if (commentText.trim()) {
      setComments((prev) => [...prev, commentText.trim()]);
      setCommentText("");
    }
  }, [commentText]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: item.title, url: item.link || undefined });
    } catch {}
  }, [item.title, item.link]);

  const handleCopyText = useCallback(() => {
    Clipboard.setStringAsync(item.description || item.title);
  }, [item.description, item.title]);

  const navigateToDetail = useCallback(() => {
    router.push({
      pathname: `/external/${item.id}` as any,
      params: {
        title: item.title,
        description: item.description ?? "",
        image_url: item.image_url ?? "",
        link: item.link ?? "",
        type: item.type,
        source: item.source,
        source_name: item.source_name ?? "",
        published_at: item.published_at ?? "",
        video_id: item.video_id ?? "",
        author: item.author ?? "",
      },
    });
  }, [item]);

  const imageUrl = item.image_url || item.thumbnail_url;
  const isVideo = item.type === "video" && item.video_id;
  const authorName = item.author ?? "Curated";

  return (
    <View style={[styles.container, { borderBottomColor: colors.divider, backgroundColor: colors.background }]}>
      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <View style={styles.anonymousAvatar}>
            <Ionicons name="help" size={18} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.headerRow}>
            <ThemedText style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
              {authorName}
            </ThemedText>
            {item.published_at ? (
              <>
                <ThemedText style={[styles.dot, { color: colors.inputBorder }]}>·</ThemedText>
                <ThemedText style={[styles.timestamp, { color: colors.muted }]}>
                  {relativeTime(item.published_at)}
                </ThemedText>
              </>
            ) : null}
          </View>

          <Pressable onPress={navigateToDetail} onLongPress={handleCopyText} style={styles.pressableContent}>
            {item.title ? (
              <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </ThemedText>
            ) : null}

            {item.description ? (
              <ThemedText style={[styles.body, { color: colors.mutedLight }]} numberOfLines={4}>
                {item.description}
              </ThemedText>
            ) : null}
          </Pressable>

          {isVideo ? (
            isActiveVideo ? (
              <YouTubeEmbed videoId={item.video_id!} isActive={true} />
            ) : (
              <Pressable onPress={navigateToDetail}>
                <View style={styles.videoThumbnail}>
                  <ResponsiveImage
                    source={item.thumbnail_url || `https://img.youtube.com/vi/${item.video_id}/hqdefault.jpg`}
                    borderRadius={14}
                  />
                  <View style={styles.playOverlay}>
                    <View style={styles.playCircle}>
                      <Ionicons name="play" size={22} color="#FFFFFF" />
                    </View>
                  </View>
                </View>
              </Pressable>
            )
          ) : imageUrl ? (
            <Pressable onPress={navigateToDetail}>
              <View style={styles.imagePressable}>
                <ResponsiveImage source={imageUrl} borderRadius={14} />
              </View>
            </Pressable>
          ) : null}

          <View style={styles.actionRow}>
            <AnimatedActionButton
              onPress={() => setShowCommentBox((p) => !p)}
              accessibilityLabel="Comment"
            >
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={showCommentBox ? colors.primary : colors.muted}
              />
              {comments.length > 0 && (
                <ThemedText style={[styles.actionCount, { color: colors.muted }]}>
                  {comments.length}
                </ThemedText>
              )}
            </AnimatedActionButton>

            <AnimatedActionButton onPress={handleLike} accessibilityLabel={liked ? "Unlike" : "Like"}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={16}
                color={liked ? colors.danger : colors.muted}
              />
              {likeCount > 0 && (
                <ThemedText style={[styles.actionCount, { color: liked ? colors.danger : colors.muted }]}>
                  {likeCount}
                </ThemedText>
              )}
            </AnimatedActionButton>

            <AnimatedActionButton onPress={handleShare} accessibilityLabel="Share">
              <Ionicons name="share-outline" size={16} color={colors.muted} />
            </AnimatedActionButton>

            <View style={{ flex: 1 }} />
          </View>

          {showCommentBox && (
            <View style={styles.commentSection}>
              {comments.map((c, i) => (
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
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
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
  anonymousAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
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
  dot: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 13,
  },
  pressableContent: {
    flex: 1,
    width: "100%",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 2,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  imagePressable: {
    marginTop: 8,
  },
  videoThumbnail: {
    marginTop: 8,
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
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
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  commentBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: "90%",
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
});
