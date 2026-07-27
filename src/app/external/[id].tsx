import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ResponsiveImage } from "@/components/responsive-image";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { useTheme } from "@/hooks/use-theme";
import { relativeTime } from "@/utils/date";

export default function ExternalDetailScreen() {
  const colors = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    description?: string;
    image_url?: string;
    link?: string;
    type?: string;
    source?: string;
    published_at?: string;
    video_id?: string;
    author?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<string[]>([]);

  const title = params.title ?? "";
  const description = params.description ?? "";
  const imageUrl = params.image_url ?? "";
  const type = params.type ?? "image";
  const publishedAt = params.published_at ?? "";
  const videoId = params.video_id ?? "";
  const author = params.author ?? "Curated";

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

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
      await Share.share({ message: title || description });
    } catch {}
  }, [title, description]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 10,
      backgroundColor: colors.background,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.divider,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
      marginHorizontal: 8,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 10,
    },
    anonymousAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#6C47FF",
      alignItems: "center",
      justifyContent: "center",
    },
    profileInfo: {
      flex: 1,
    },
    authorName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    timeText: {
      fontSize: 13,
      color: colors.muted,
    },
    titleText: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      lineHeight: 28,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    description: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.mutedLight,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    mediaSection: {
      marginTop: 4,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 28,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      borderTopWidth: 0.5,
      borderTopColor: colors.divider,
      marginTop: 12,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
    },
    actionCount: {
      fontSize: 14,
      color: colors.mutedLight,
    },
    commentSection: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 8,
    },
    commentBubble: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
      maxWidth: "85%",
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
    },
    commentInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    commentInputWrapper: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 24,
      paddingHorizontal: 16,
      height: 42,
      justifyContent: "center",
    },
    commentInput: {
      fontSize: 15,
      paddingVertical: 0,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.7,
    },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          Post
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profileRow}>
          <View style={styles.anonymousAvatar}>
            <Ionicons name="help" size={18} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <ThemedText style={styles.authorName}>{author}</ThemedText>
            {publishedAt ? (
              <ThemedText style={styles.timeText}>{relativeTime(publishedAt)}</ThemedText>
            ) : null}
          </View>
        </View>

        {title ? (
          <ThemedText style={styles.titleText}>{title}</ThemedText>
        ) : null}

        {description ? (
          <ThemedText style={styles.description}>{description}</ThemedText>
        ) : null}

        {type === "video" && videoId ? (
          <View style={styles.mediaSection}>
            <YouTubeEmbed videoId={videoId} />
          </View>
        ) : imageUrl ? (
          <View style={styles.mediaSection}>
            <ResponsiveImage source={imageUrl} borderRadius={0} />
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleLike}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel={liked ? "Unlike" : "Like"}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={22}
              color={liked ? colors.danger : colors.mutedLight}
            />
            {likeCount > 0 && (
              <ThemedText style={[styles.actionCount, { color: liked ? colors.danger : colors.mutedLight }]}>
                {likeCount}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={() => setShowCommentBox((p) => !p)}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Comment"
          >
            <Ionicons name="chatbubble-outline" size={20} color={showCommentBox ? colors.primary : colors.mutedLight} />
            {comments.length > 0 && (
              <ThemedText style={[styles.actionCount, { color: colors.mutedLight }]}>{comments.length}</ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            accessibilityLabel="Share"
          >
            <Ionicons name="share-outline" size={20} color={colors.mutedLight} />
          </Pressable>
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
                  style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}
                  accessibilityLabel="Send comment"
                >
                  <Ionicons name="send" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
