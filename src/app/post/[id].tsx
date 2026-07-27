import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Avatar } from "@/components/ui/Avatar";
import { ImageViewer } from "@/components/image-viewer";
import { ResponsiveImage } from "@/components/responsive-image";
import { DetailSkeleton } from "@/components/feed-skeleton";
import { spacing } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { useRefresh } from "@/hooks/use-refresh";
import { usePostInteractions } from "@/hooks/use-post-interactions";
import { fetchPostById, likePost, unlikePost, deletePost } from "@/services/posts";
import { fetchComments, createComment } from "@/services/comments";
import { followUser, unfollowUser } from "@/services/follows";
import { submitReport } from "@/services/reports";
import { resolveImageUrl } from "@/services/storage";
import { repostPost, unrepostPost } from "@/services/reposts";
import { setReaction, removeReaction, REACTION_EMOJIS, type ReactionEmoji } from "@/services/reactions";
import { db_ops } from "@/services/db";
import type { PostWithProfile, CommentWithProfile } from "@/services/database.types";
import { relativeTime, fullTimestamp } from "@/utils/date";

function formatMetrics(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { profile } = useProfile();
  const { triggerFeedRefresh } = useRefresh();
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const currentUserId = session?.user?.id;
  const [post, setPost] = useState<PostWithProfile | null>(null);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showRepostSheet, setShowRepostSheet] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const {
    reactionsMap,
    repostedIds,
    repostCounts,
    commentCounts: sharedCommentCounts,
    toggleReaction: ctxToggleReaction,
    toggleRepost: ctxToggleRepost,
  } = usePostInteractions();

  const likeScale = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  const resolvedImage = resolveImageUrl(post?.image_url, "post-images");
  const images: { uri: string; id: string }[] = resolvedImage
    ? [{ uri: resolvedImage, id: "main" }]
    : [];

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [postData, commentResult] = await Promise.allSettled([
        fetchPostById(id),
        fetchComments(id),
      ]);
      if (postData.status === "fulfilled") setPost(postData.value);
      else throw postData.reason;
      setComments(commentResult.status === "fulfilled" ? commentResult.value : []);

      if (currentUserId && postData.status === "fulfilled" && postData.value?.user_id && postData.value.user_id !== currentUserId) {
        const followId = `${currentUserId}_${postData.value.user_id}`;
        const existing = await db_ops.get("follows", followId);
        setIsFollowing(!!existing);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);

  useEffect(() => { load(); }, [load]);

  const userLiked = post?.likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = post?.likes?.length ?? 0;
  const reactions = (id ? reactionsMap.get(id as string) : undefined) ?? [];
  const userReaction = reactions.find((r) => r.user_id === currentUserId)?.emoji ?? null;
  const commentCount = (id ? sharedCommentCounts.get(id as string) : undefined) ?? comments.length;
  const isReposted = (id ? repostedIds.has(id as string) : false);
  const repostCount = (id ? repostCounts.get(id as string) : undefined) ?? 0;
  const authorName = post?.profiles?.name ?? "Unknown";
  const authorDept = post?.profiles?.department ?? "";
  const isOwnPost = post?.user_id === currentUserId;

  const handleLike = useCallback(async () => {
    if (!post) return;
    const wasLiked = userLiked;
    if (wasLiked) {
      setPost((prev) =>
        prev ? { ...prev, likes: prev.likes.filter((l) => l.user_id !== currentUserId) } : prev
      );
    } else {
      setPost((prev) =>
        prev ? { ...prev, likes: [...prev.likes, { id: "", user_id: currentUserId! }] } : prev
      );
    }
    likeScale.setValue(1);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: Platform.OS !== "web", friction: 3 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: Platform.OS !== "web", friction: 3 }),
    ]).start();
    try {
      if (wasLiked) {
        await unlikePost(post.id);
      } else {
        await likePost(post.id);
      }
    } catch {
      setPost((prev) =>
        prev ? { ...prev, likes: wasLiked ? [...prev.likes, { id: "", user_id: currentUserId! }] : prev.likes.filter((l) => l.user_id !== currentUserId) } : prev
      );
    }
  }, [post, userLiked, currentUserId, likeScale, triggerFeedRefresh]);

  const handleShare = useCallback(async () => {
    if (!post) return;
    try {
      await Share.share({
        message: post.content,
        url: `campusvibe://post/${post.id}`,
      });
    } catch {}
  }, [post]);

  const handleCopyText = useCallback(async () => {
    if (!post) return;
    await Clipboard.setStringAsync(post.content);
    setShowMenu(false);
  }, [post]);

  const handleReport = useCallback(async () => {
    if (!post) return;
    try {
      await submitReport(post.id, "post", "Other");
    } catch {}
    setShowMenu(false);
  }, [post]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  const handleDeletePost = useCallback(async () => {
    if (!post) return;
    setShowDeleteConfirm(false);
    try {
      await deletePost(post.id);
      triggerFeedRefresh();
      goBack();
    } catch {
      Alert.alert("Error", "Could not delete post. Please try again.");
    }
  }, [post, goBack, triggerFeedRefresh]);

  const handleFollow = useCallback(async () => {
    if (!post) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await unfollowUser(post.user_id);
      } else {
        await followUser(post.user_id);
      }
    } catch {
      setIsFollowing(wasFollowing);
    }
  }, [post, isFollowing]);

  const handleReaction = useCallback(async (emoji: ReactionEmoji) => {
    if (!post || !id || !currentUserId) return;
    const wasReaction = userReaction;
    setShowReactionPicker(false);
    if (wasReaction === emoji) {
      ctxToggleReaction(id, currentUserId, null);
      try {
        await removeReaction(post.id);
      } catch { ctxToggleReaction(id, currentUserId, wasReaction); }
    } else {
      ctxToggleReaction(id, currentUserId, emoji);
      try {
        await setReaction(post.id, emoji);
      } catch { ctxToggleReaction(id, currentUserId, wasReaction); }
    }
  }, [post, id, userReaction, currentUserId, ctxToggleReaction]);

  const handleRepost = useCallback(async () => {
    if (!post || isOwnPost || !id || !currentUserId) return;
    const wasReposted = isReposted;
    ctxToggleRepost(id, currentUserId, !wasReposted);
    setShowRepostSheet(false);
    try {
      if (wasReposted) {
        await unrepostPost(post.id);
      } else {
        await repostPost(post.id);
      }
    } catch {
      ctxToggleRepost(id, currentUserId, wasReposted);
    }
  }, [post, isOwnPost, isReposted, id, currentUserId, ctxToggleRepost]);

  const handleSendReply = useCallback(async () => {
    if (!id || !replyText.trim() || sendingReply) return;
    const text = replyText.trim();
    const optimistic: CommentWithProfile = {
      id: `temp-${Date.now()}`,
      post_id: id,
      user_id: currentUserId ?? "",
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        name: profile?.name ?? "You",
        department: profile?.department ?? "",
      },
    };
    setReplyError(null);
    setReplyText("");
    setComments((prev) => [...prev, optimistic]);
    setSendingReply(true);
    try {
      const created = await createComment(id, text);
      if (created) {
        setComments((prev) =>
          prev.map((c) => (c.id === optimistic.id ? { ...c, id: created.id } : c))
        );
        const updated = await fetchComments(id);
        setComments(updated);
      }
    } catch (e) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      const err = e as Error & { code?: string };
      const msg = err?.message ?? "Failed to send reply";
      const code = err?.code ?? "";
      if (msg.includes("row-level security") || code === "42501") {
        setReplyError("You need a verified student ID to comment. Upload your ID in settings.");
      } else {
        setReplyError(msg);
      }
    } finally {
      setSendingReply(false);
    }
  }, [id, replyText, sendingReply, currentUserId]);

  const menuItems: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string }[] = [
    { label: "Report post", icon: "flag-outline", onPress: handleReport },
    { label: "Copy text", icon: "copy-outline", onPress: handleCopyText },
    { label: "Share post", icon: "share-outline", onPress: () => { setShowMenu(false); handleShare(); } },
    {
      label: "Delete post",
      icon: "trash-outline",
      onPress: () => {
        setShowMenu(false);
        setShowDeleteConfirm(true);
      },
      color: colors.danger,
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    errorText: {
      marginBottom: spacing.md,
      fontSize: 15,
      lineHeight: 21,
    },
    goBack: {
      fontWeight: "600",
      fontSize: 15,
      lineHeight: 21,
    },
    backBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    customHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingBottom: 8,
      borderBottomWidth: 0.5,
    },
    headerBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    actionSheet: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 34,
    },
    actionSheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 8,
    },
    actionSheetItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
    },
    actionSheetItemBorder: {
      borderBottomWidth: 0.5,
    },
    actionSheetLabel: {
      fontSize: 16,
      fontWeight: "500",
    },
    actionSheetCancel: {
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
      borderTopWidth: 0.5,
    },
    actionSheetCancelText: {
      fontSize: 16,
      fontWeight: "500",
    },
    pressed: {
      opacity: 0.6,
    },
    imageViewerOverlay: {
      ...StyleSheet.absoluteFillObject as object,
      backgroundColor: "rgba(0,0,0,0.95)",
    },
    imageViewerClose: {
      position: "absolute",
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    bodyContainer: {
      flex: 1,
      position: "relative",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    authorCol: {
      flex: 1,
      gap: 1,
    },
    authorName: {
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    authorHandle: {
      fontSize: 13,
      lineHeight: 18,
    },
    followBtn: {
      height: 32,
      paddingHorizontal: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    followBtnText: {
      fontSize: 13,
      fontWeight: "600",
    },
    postBody: {
      fontSize: 17,
      lineHeight: 24,
      fontWeight: "400",
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
    },
    imageSection: {
      marginBottom: spacing.md,
      marginHorizontal: 16,
      borderRadius: 14,
      overflow: "hidden",
    },
    postImage: {
      width: "100%" as const,
      minHeight: 200,
      borderRadius: 12,
    },
    timestampRow: {
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
    },
    timestampText: {
      fontSize: 14,
      fontWeight: "400",
    },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
    },
    metricsText: {
      fontSize: 14,
      fontWeight: "400",
    },
    metricsBold: {
      fontWeight: "700",
    },
    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      height: 44,
      borderBottomWidth: 0.5,
      paddingHorizontal: 8,
    },
    actionBarBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      height: 44,
      minWidth: 44,
    },
    actionBarCount: {
      fontSize: 11,
      fontWeight: "500",
    },
    sectionSeparator: {
      height: 12,
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
    },
    repliesHeading: {
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    commentCard: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
    },
    commentHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    commentMeta: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    commentAuthor: {
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
    },
    commentTime: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "400",
    },
    commentContent: {
      fontSize: 15,
      lineHeight: 21,
      marginTop: spacing.xs + 2,
      paddingLeft: 44,
    },
    emptyReplies: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xl * 2,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
    },
    replyErrorBar: {
      position: "absolute",
      bottom: 72,
      left: 0,
      right: 0,
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    replyErrorText: {
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    replyDock: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderTopWidth: 0.5,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    replyInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 24,
      paddingVertical: 10,
      paddingHorizontal: 16,
      fontSize: 15,
      maxHeight: 80,
      minHeight: 38,
    },
    sendBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    reactionSummary: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
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
      marginHorizontal: spacing.md,
      marginBottom: 8,
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
    reactionOptionActive: {
      backgroundColor: "rgba(108, 71, 255, 0.2)",
    },
    reactionOptionEmoji: {
      fontSize: 22,
    },
  });

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <DetailSkeleton />
      </View>
    );
  }

  if (error || !post) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: colors.background }]}>
        <ThemedText style={[styles.errorText, { color: colors.subtleText }]}>
          {error ?? "Post not found"}
        </ThemedText>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <ThemedText style={[styles.goBack, { color: colors.primary }]}>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6, backgroundColor: colors.background, borderBottomColor: colors.divider }]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textOnDark} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.textOnDark }]}></ThemedText>
        <Pressable
          onPress={() => setShowMenu(true)}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textOnDark} />
        </Pressable>
      </View>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.actionSheet, { backgroundColor: colors.inputBg }]}>
            <View style={[styles.actionSheetHandle, { backgroundColor: colors.inputBgAlt }]} />
            {menuItems.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.actionSheetItem,
                  i < menuItems.length - 1 && [styles.actionSheetItemBorder, { borderBottomColor: colors.inputBgAlt }],
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={item.icon} size={20} color={item.color ?? colors.textBody} />
                <ThemedText style={[styles.actionSheetLabel, { color: colors.textBody }, item.color ? { color: item.color } : undefined]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowMenu(false)}
              style={({ pressed }) => [styles.actionSheetCancel, { borderTopColor: colors.inputBgAlt }, pressed && styles.pressed]}
            >
              <ThemedText style={[styles.actionSheetCancelText, { color: colors.muted }]}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showRepostSheet} transparent animationType="fade" onRequestClose={() => setShowRepostSheet(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRepostSheet(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.actionSheet, { backgroundColor: colors.inputBg }]}>
            <View style={[styles.actionSheetHandle, { backgroundColor: colors.inputBgAlt }]} />
            <Pressable onPress={() => setShowRepostSheet(false)} style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}>
              <Ionicons name="repeat" size={20} color={colors.textBody} />
              <ThemedText style={[styles.actionSheetLabel, { color: colors.textBody }]}>Repost</ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowRepostSheet(false)} style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}>
              <Ionicons name="chatbox-outline" size={20} color={colors.textBody} />
              <ThemedText style={[styles.actionSheetLabel, { color: colors.textBody }]}>Quote Post</ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowRepostSheet(false)} style={({ pressed }) => [styles.actionSheetCancel, { borderTopColor: colors.inputBgAlt }, pressed && styles.pressed]}>
              <ThemedText style={[styles.actionSheetCancelText, { color: colors.muted }]}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <View style={styles.imageViewerOverlay}>
          <ImageViewer uri={images[0]?.uri ?? ""} />
          <Pressable
            onPress={() => setShowImageViewer(false)}
            style={[styles.imageViewerClose, { top: insets.top + 16 }]}
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={24} color={colors.textOnDark} />
          </Pressable>
        </View>
      </Modal>

      <View style={styles.bodyContainer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.authorRow}>
            <Avatar name={authorName} size={48} />
            <View style={styles.authorCol}>
              <ThemedText style={[styles.authorName, { color: colors.textOnDark }]} numberOfLines={1}>{authorName}</ThemedText>
              <ThemedText style={[styles.authorHandle, { color: colors.muted }]} numberOfLines={1}>
                {authorDept || ""}
              </ThemedText>
            </View>
            {!isOwnPost && (
              <Pressable
                onPress={handleFollow}
                style={({ pressed }) => [
                  styles.followBtn,
                  { borderColor: colors.primary },
                  isFollowing && { backgroundColor: colors.primary, borderColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={[styles.followBtnText, { color: colors.primary }, isFollowing && { color: colors.textOnDark }]}>
                  {isFollowing ? "Following" : "Follow"}
                </ThemedText>
              </Pressable>
            )}
          </View>

          <ThemedText style={[styles.postBody, { color: colors.warmInverse }]}>{post.content}</ThemedText>

          {images.length > 0 && (
            <View style={[styles.imageSection, { backgroundColor: "#0A0A0C" }]}>
              <Pressable onPress={() => setShowImageViewer(true)}>
                <ResponsiveImage
                  source={images[0].uri}
                  borderRadius={0}
                />
              </Pressable>
            </View>
          )}

          {reactions.length > 0 && (
            <View style={styles.reactionSummary}>
              {Object.entries(
                reactions.reduce<Record<string, number>>((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReaction(emoji as ReactionEmoji)}
                  style={[
                    styles.reactionPill,
                    userReaction === emoji && [styles.reactionPillActive, { borderColor: colors.primary, backgroundColor: `${colors.primary}26` }],
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

          {showReactionPicker && (
            <View style={[styles.reactionPicker, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
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
                <Ionicons name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          )}

          <View style={[styles.timestampRow, { borderBottomColor: colors.divider }]}>
            <ThemedText style={[styles.timestampText, { color: colors.muted }]}>
              {fullTimestamp(post.created_at)}
            </ThemedText>
          </View>

          <View style={[styles.metricsRow, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>
            <ThemedText style={[styles.metricsText, { color: colors.muted }]}>
              <ThemedText style={[styles.metricsBold, { color: colors.textOnDark }]}>{formatMetrics(likeCount)}</ThemedText>
              {" Likes"}
            </ThemedText>
            <ThemedText style={[styles.metricsText, { color: colors.muted }]}> · </ThemedText>
            <ThemedText style={[styles.metricsText, { color: colors.muted }]}>
              <ThemedText style={[styles.metricsBold, { color: colors.textOnDark }]}>{formatMetrics(commentCount)}</ThemedText>
              {" Comments"}
            </ThemedText>
          </View>

          <View style={[styles.actionBar, { borderBottomColor: colors.divider }]}>
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={styles.actionBarBtn}
              accessibilityLabel="Reply"
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.muted} />
              {commentCount > 0 && (
                <ThemedText style={[styles.actionBarCount, { color: colors.muted }]}>{formatMetrics(commentCount)}</ThemedText>
              )}
            </Pressable>

            {!isOwnPost && (
              <Pressable
                onPress={handleRepost}
                style={styles.actionBarBtn}
                accessibilityLabel={isReposted ? "Undo repost" : "Repost"}
              >
                <Ionicons
                  name="repeat-outline"
                  size={22}
                  color={isReposted ? colors.success : colors.muted}
                />
                {repostCount > 0 && (
                  <ThemedText style={[styles.actionBarCount, { color: isReposted ? colors.success : colors.muted }]}>
                    {formatMetrics(repostCount)}
                  </ThemedText>
                )}
              </Pressable>
            )}

            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Pressable
                onPress={handleLike}
                onLongPress={() => !isOwnPost && setShowReactionPicker(true)}
                style={styles.actionBarBtn}
                accessibilityLabel={userLiked ? "Unlike" : "Like"}
              >
                <Ionicons
                  name={userLiked ? "heart" : "heart-outline"}
                  size={22}
                  color={userLiked ? colors.likeActive : colors.muted}
                />
                {likeCount > 0 && (
                  <ThemedText style={[styles.actionBarCount, { color: userLiked ? colors.likeActive : colors.muted }]}>
                    {formatMetrics(likeCount)}
                  </ThemedText>
                )}
              </Pressable>
            </Animated.View>

            <Pressable onPress={handleShare} style={styles.actionBarBtn} accessibilityLabel="Share">
              <Ionicons name="arrow-up-outline" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <View style={[styles.sectionSeparator, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.divider, borderBottomColor: colors.divider }]} />

          {comments.length > 0 && (
            <ThemedText style={[styles.repliesHeading, { color: colors.textOnDark }]}>Replies</ThemedText>
          )}

          {comments.map((item) => (
            <View key={item.id} style={[styles.commentCard, { borderBottomColor: colors.divider }]}>
              <View style={styles.commentHeader}>
                <Avatar name={item.profiles?.name ?? "?"} size={36} />
                <View style={styles.commentMeta}>
                  <ThemedText style={[styles.commentAuthor, { color: colors.textOnDark }]}>
                    {item.profiles?.name ?? "Unknown"}
                  </ThemedText>
                  <ThemedText style={[styles.commentTime, { color: colors.muted }]}>
                    {relativeTime(item.created_at)}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.commentContent, { color: colors.textBody }]}>{item.content}</ThemedText>
            </View>
          ))}

          {comments.length === 0 && (
            <View style={styles.emptyReplies}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.borderLight} />
              <ThemedText style={[styles.emptyText, { color: colors.subtleText }]}>No replies yet</ThemedText>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {replyError && (
          <View style={styles.replyErrorBar}>
            <ThemedText style={[styles.replyErrorText, { color: colors.danger }]}>{replyError}</ThemedText>
          </View>
        )}

        <View style={[styles.replyDock, { paddingBottom: insets.bottom + 8, borderTopColor: colors.divider }]}>
          <Avatar name={session?.user?.id ?? "?"} size={36} />
          <TextInput
            ref={inputRef}
            style={[styles.replyInput, { backgroundColor: colors.backgroundElement, borderColor: colors.divider, color: colors.textOnDark }]}
            placeholder="Post your reply"
            placeholderTextColor={colors.muted}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSendReply}
            disabled={!replyText.trim() || sendingReply}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: colors.primary },
              (!replyText.trim() || sendingReply) && { backgroundColor: colors.inputBg },
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Send reply"
          >
            <Ionicons
              name="arrow-forward"
              size={18}
              color={!replyText.trim() || sendingReply ? colors.textTertiary : colors.textOnDark}
            />
          </Pressable>
        </View>
      </View>

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.actionSheet, { backgroundColor: colors.inputBg }]}>
            <View style={[styles.actionSheetHandle, { backgroundColor: colors.inputBgAlt }]} />
            <ThemedText style={{ fontSize: 17, fontWeight: "700", color: colors.textOnDark, textAlign: "center", marginBottom: 8 }}>Delete post?</ThemedText>
            <ThemedText style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 20, paddingHorizontal: 16 }}>This action cannot be undone.</ThemedText>
            <Pressable
              onPress={handleDeletePost}
              style={({ pressed }) => [styles.actionSheetItem, { justifyContent: "center" }, pressed && styles.pressed]}
            >
              <ThemedText style={{ fontSize: 16, fontWeight: "600", color: colors.danger }}>Delete</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowDeleteConfirm(false)}
              style={({ pressed }) => [styles.actionSheetCancel, { borderTopColor: colors.inputBgAlt }, pressed && styles.pressed]}
            >
              <ThemedText style={[styles.actionSheetCancelText, { color: colors.muted }]}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}
