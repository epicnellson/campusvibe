import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
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
import { spacing, colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/hooks/use-profile";
import { fetchPostById, likePost, unlikePost } from "@/services/posts";
import { fetchComments, createComment } from "@/services/comments";
import { followUser, unfollowUser } from "@/services/follows";
import { submitReport } from "@/services/reports";
import { resolveImageUrl } from "@/services/storage";
import type { PostWithProfile, CommentWithProfile } from "@/services/database.types";

function formatFullTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${time} \u00B7 ${date}`;
}

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

function formatMetrics(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const currentUserId = session?.user?.id;
  const [post, setPost] = useState<PostWithProfile | null>(null);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showRepostSheet, setShowRepostSheet] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);

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
      const [data, commentData] = await Promise.all([
        fetchPostById(id),
        fetchComments(id),
      ]);
      setPost(data);
      setComments(commentData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const userLiked = post?.likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = post?.likes?.length ?? 0;
  const commentCount = comments.length;
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
  }, [post, userLiked, currentUserId, likeScale]);

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

  const handleDeletePost = useCallback(async () => {
    if (!post || !currentUserId) return;
    try {
      const { supabase } = await import("@/services/supabase");
      await supabase.from("posts").delete().eq("id", post.id).eq("user_id", currentUserId);
      router.back();
    } catch {}
    setShowMenu(false);
  }, [post, currentUserId]);

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
  ];
  if (!isOwnPost) {
    menuItems.push({ label: "Block user", icon: "ban-outline", onPress: () => setShowMenu(false), color: "#EF4444" });
  }
  if (isOwnPost) {
    menuItems.push({ label: "Delete post", icon: "trash-outline", onPress: handleDeletePost, color: "#EF4444" });
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (error || !post) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.errorText}>
          {error ?? "Post not found"}
        </ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={styles.goBack}>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <ThemedText style={styles.headerTitle}></ThemedText>
        <Pressable
          onPress={() => setShowMenu(true)}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            {menuItems.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.actionSheetItem,
                  i < menuItems.length - 1 && styles.actionSheetItemBorder,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={item.icon} size={20} color={item.color ?? "#E1E1E1"} />
                <ThemedText style={[styles.actionSheetLabel, item.color ? { color: item.color } : undefined]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowMenu(false)}
              style={({ pressed }) => [styles.actionSheetCancel, pressed && styles.pressed]}
            >
              <ThemedText style={styles.actionSheetCancelText}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showRepostSheet} transparent animationType="fade" onRequestClose={() => setShowRepostSheet(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRepostSheet(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Pressable onPress={() => setShowRepostSheet(false)} style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}>
              <Ionicons name="repeat" size={20} color="#E1E1E1" />
              <ThemedText style={styles.actionSheetLabel}>Repost</ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowRepostSheet(false)} style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}>
              <Ionicons name="chatbox-outline" size={20} color="#E1E1E1" />
              <ThemedText style={styles.actionSheetLabel}>Quote Post</ThemedText>
            </Pressable>
            <Pressable onPress={() => setShowRepostSheet(false)} style={({ pressed }) => [styles.actionSheetCancel, pressed && styles.pressed]}>
              <ThemedText style={styles.actionSheetCancelText}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <Pressable style={styles.imageViewerOverlay} onPress={() => setShowImageViewer(false)}>
          <ImageViewer uri={images[0]?.uri ?? ""} />
          <Pressable
            onPress={() => setShowImageViewer(false)}
            style={[styles.imageViewerClose, { top: insets.top + 16 }]}
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
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
              <ThemedText style={styles.authorName} numberOfLines={1}>{authorName}</ThemedText>
              <ThemedText style={styles.authorHandle} numberOfLines={1}>
                {authorDept || ""}
              </ThemedText>
            </View>
            {!isOwnPost && (
              <Pressable
                onPress={handleFollow}
                style={({ pressed }) => [
                  styles.followBtn,
                  isFollowing && styles.followBtnActive,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? "Following" : "Follow"}
                </ThemedText>
              </Pressable>
            )}
          </View>

          <ThemedText style={styles.postBody}>{post.content}</ThemedText>

          {images.length > 0 && (
            <View style={styles.imageSection}>
              <Pressable onPress={() => setShowImageViewer(true)}>
                <Image
                  source={{ uri: images[0].uri }}
                  style={styles.postImage}
                  resizeMode="contain"
                />
              </Pressable>
            </View>
          )}

          <View style={styles.timestampRow}>
            <ThemedText style={styles.timestampText}>
              {formatFullTimestamp(post.created_at)}
            </ThemedText>
          </View>

          <View style={styles.metricsRow}>
            <ThemedText style={styles.metricsText}>
              <ThemedText style={styles.metricsBold}>{formatMetrics(likeCount)}</ThemedText>
              {" Likes"}
            </ThemedText>
            <ThemedText style={styles.metricsText}> · </ThemedText>
            <ThemedText style={styles.metricsText}>
              <ThemedText style={styles.metricsBold}>{formatMetrics(commentCount)}</ThemedText>
              {" Comments"}
            </ThemedText>
          </View>

          <View style={styles.actionBar}>
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={styles.actionBarBtn}
              accessibilityLabel="Reply"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#71717A" />
              {commentCount > 0 && (
                <ThemedText style={styles.actionBarCount}>{formatMetrics(commentCount)}</ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={() => setShowRepostSheet(true)}
              style={styles.actionBarBtn}
              accessibilityLabel="Repost"
            >
              <Ionicons name="repeat-outline" size={22} color="#71717A" />
            </Pressable>

            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Pressable
                onPress={handleLike}
                style={styles.actionBarBtn}
                accessibilityLabel={userLiked ? "Unlike" : "Like"}
              >
                <Ionicons
                  name={userLiked ? "heart" : "heart-outline"}
                  size={22}
                  color={userLiked ? "#E0245E" : "#71717A"}
                />
                {likeCount > 0 && (
                  <ThemedText style={[styles.actionBarCount, { color: userLiked ? "#E0245E" : "#71717A" }]}>
                    {formatMetrics(likeCount)}
                  </ThemedText>
                )}
              </Pressable>
            </Animated.View>

            <Pressable onPress={handleShare} style={styles.actionBarBtn} accessibilityLabel="Share">
              <Ionicons name="arrow-up-outline" size={22} color="#71717A" />
            </Pressable>
          </View>

          <View style={styles.sectionSeparator} />

          {comments.length > 0 && (
            <ThemedText style={styles.repliesHeading}>Replies</ThemedText>
          )}

          {comments.map((item) => (
            <View key={item.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Avatar name={item.profiles?.name ?? "?"} size={36} />
                <View style={styles.commentMeta}>
                  <ThemedText style={styles.commentAuthor}>
                    {item.profiles?.name ?? "Unknown"}
                  </ThemedText>
                  <ThemedText style={styles.commentTime}>
                    {relativeTime(item.created_at)}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.commentContent}>{item.content}</ThemedText>
            </View>
          ))}

          {comments.length === 0 && (
            <View style={styles.emptyReplies}>
              <Ionicons name="chatbubbles-outline" size={28} color="#3A3A3A" />
              <ThemedText style={styles.emptyText}>No replies yet</ThemedText>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {replyError && (
          <View style={styles.replyErrorBar}>
            <ThemedText style={styles.replyErrorText}>{replyError}</ThemedText>
          </View>
        )}

        <View style={[styles.replyDock, { paddingBottom: insets.bottom + 8 }]}>
          <Avatar name={session?.user?.id ?? "?"} size={36} />
          <TextInput
            ref={inputRef}
            style={styles.replyInput}
            placeholder="Post your reply"
            placeholderTextColor="#71717A"
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
              (!replyText.trim() || sendingReply) && styles.sendBtnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Send reply"
          >
            <Ionicons
              name="arrow-forward"
              size={18}
              color={!replyText.trim() || sendingReply ? "#525252" : "#FFFFFF"}
            />
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: "#9CA3AF",
    marginBottom: spacing.md,
    fontSize: 15,
    lineHeight: 21,
  },
  goBack: {
    color: colors.primary,
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
    backgroundColor: "#000000",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
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
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#262626",
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
    borderBottomColor: "#262626",
  },
  actionSheetLabel: {
    fontSize: 16,
    color: "#E1E1E1",
    fontWeight: "500",
  },
  actionSheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#262626",
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: "#71717A",
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.6,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
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
    color: "#FFFFFF",
    lineHeight: 20,
  },
  authorHandle: {
    fontSize: 13,
    color: "#71717A",
    lineHeight: 18,
  },
  followBtn: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  followBtnActive: {
    backgroundColor: "#6C47FF",
    borderColor: "#6C47FF",
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6C47FF",
  },
  followBtnTextActive: {
    color: "#FFFFFF",
  },
  postBody: {
    fontSize: 17,
    lineHeight: 24,
    color: "#F0F0F0",
    fontWeight: "400",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  imageSection: {
    marginBottom: spacing.md,
    backgroundColor: "#0A0A0C",
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  postImage: {
    width: "100%" as const,
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: "#0A0A0C",
  },
  timestampRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  timestampText: {
    fontSize: 14,
    color: "#71717A",
    fontWeight: "400",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E1E",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  metricsText: {
    fontSize: 14,
    color: "#71717A",
    fontWeight: "400",
  },
  metricsBold: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
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
    color: "#71717A",
    fontWeight: "500",
  },
  sectionSeparator: {
    height: 12,
    backgroundColor: "#0A0A0A",
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E1E",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  repliesHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 21,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  commentCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
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
    color: "#FFFFFF",
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 12,
    color: "#71717A",
    lineHeight: 18,
    fontWeight: "400",
  },
  commentContent: {
    fontSize: 15,
    lineHeight: 21,
    color: "#E1E1E1",
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
    color: "#52525B",
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
    color: "#EF4444",
    lineHeight: 18,
    textAlign: "center",
  },
  replyDock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#000000",
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E1E",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  replyInput: {
    flex: 1,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 15,
    maxHeight: 80,
    minHeight: 38,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#1A1A1A",
  },
});
