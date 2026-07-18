import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ImageViewer } from "@/components/image-viewer";
import { spacing, colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { fetchConfessionById, likeConfession, unlikeConfession, deleteConfession } from "@/services/confessions";
import { submitReport } from "@/services/reports";
import { resolveImageUrl } from "@/services/storage";
import type { ConfessionWithLikes } from "@/services/database.types";

const ANIMALS = [
  "Panda", "Fox", "Owl", "Dolphin", "Tiger", "Koala", "Penguin",
  "Raccoon", "Sloth", "Hedgehog", "Otter", "Falcon", "Wolf", "Badger",
];

const AVATAR_COLORS = [
  "#FF5722", "#E91E63", "#9C27B0", "#3F51B5", "#00BCD4",
  "#4CAF50", "#FFEB3B", "#FF9800", "#795548", "#607D8B",
];

function animalFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return ANIMALS[Math.abs(hash) % ANIMALS.length];
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

function formatFullTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${time} \u00B7 ${date}`;
}

export default function ConfessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const currentUserId = session?.user?.id;
  const [confession, setConfession] = useState<ConfessionWithLikes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);

  const likeScale = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchConfessionById(id);
      setConfession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load confession");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const userLiked = confession?.confession_likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = confession?.confession_likes?.length ?? 0;
  const isOwnPost = confession?.user_id === currentUserId;

  const animalName = confession ? animalFromId(confession.id) : "";
  const avatarColor = confession ? colorFromId(confession.id) : "#607D8B";

  const resolvedImage = resolveImageUrl(confession?.image_url, "post-images");

  const handleLike = useCallback(async () => {
    if (!confession) return;
    const wasLiked = userLiked;
    if (wasLiked) {
      setConfession((prev) =>
        prev ? { ...prev, confession_likes: prev.confession_likes.filter((l) => l.user_id !== currentUserId) } : prev
      );
    } else {
      setConfession((prev) =>
        prev ? { ...prev, confession_likes: [...prev.confession_likes, { id: "", user_id: currentUserId! }] } : prev
      );
    }
    likeScale.setValue(1);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: Platform.OS !== "web", friction: 3 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: Platform.OS !== "web", friction: 3 }),
    ]).start();
    try {
      if (wasLiked) {
        await unlikeConfession(confession.id);
      } else {
        await likeConfession(confession.id);
      }
    } catch {
      setConfession((prev) =>
        prev ? { ...prev, confession_likes: wasLiked ? [...prev.confession_likes, { id: "", user_id: currentUserId! }] : prev.confession_likes.filter((l) => l.user_id !== currentUserId) } : prev
      );
    }
  }, [confession, userLiked, currentUserId, likeScale]);

  const handleShare = useCallback(async () => {
    if (!confession) return;
    try {
      await Share.share({ message: confession.content });
    } catch {}
  }, [confession]);

  const handleCopyText = useCallback(async () => {
    if (!confession) return;
    await Clipboard.setStringAsync(confession.content);
    setShowMenu(false);
  }, [confession]);

  const handleReport = useCallback(async () => {
    if (!confession) return;
    try {
      await submitReport(confession.id, "confession", "Other");
    } catch {}
    setShowMenu(false);
  }, [confession]);

  const handleDeleteConfession = useCallback(async () => {
    if (!confession) return;
    try {
      await deleteConfession(confession.id);
      router.back();
    } catch {
      Alert.alert("Error", "Could not delete confession. Please try again.");
    }
    setShowMenu(false);
  }, [confession]);

  const menuItems: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string }[] = [
    { label: "Report confession", icon: "flag-outline", onPress: handleReport },
    { label: "Copy text", icon: "copy-outline", onPress: handleCopyText },
    { label: "Share confession", icon: "share-outline", onPress: () => { setShowMenu(false); handleShare(); } },
    {
      label: "Delete confession",
      icon: "trash-outline",
      onPress: () => {
        setShowMenu(false);
        Alert.alert("Delete confession", "Are you sure you want to delete this confession?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: handleDeleteConfession },
        ]);
      },
      color: "#EF4444",
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !confession) {
    return (
      <View style={styles.center}>
        <ThemedText style={styles.errorText}>{error ?? "Confession not found"}</ThemedText>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={styles.goBack}>Go back</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Confession</ThemedText>
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

      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <View style={styles.imageViewerOverlay}>
          <ImageViewer uri={resolvedImage ?? ""} />
          <Pressable
            onPress={() => setShowImageViewer(false)}
            style={[styles.imageViewerClose, { top: insets.top + 16 }]}
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Author row - anonymous */}
        <View style={styles.authorRow}>
          <View style={[styles.anonAvatar, { backgroundColor: avatarColor }]}>
            <ThemedText style={styles.anonAvatarText}>?</ThemedText>
          </View>
          <View style={styles.authorCol}>
            <ThemedText style={styles.authorName}>Anonymous {animalName}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.postBody}>{confession.content}</ThemedText>

        {resolvedImage && (
          <Pressable onPress={() => setShowImageViewer(true)} style={styles.imageSection}>
            <Image
              source={{ uri: resolvedImage }}
              style={styles.postImage}
              resizeMode="contain"
            />
          </Pressable>
        )}

        <View style={styles.timestampRow}>
          <ThemedText style={styles.timestampText}>
            {formatFullTimestamp(confession.created_at)}
          </ThemedText>
        </View>

        <View style={styles.metricsRow}>
          <ThemedText style={styles.metricsText}>
            <ThemedText style={styles.metricsBold}>{likeCount}</ThemedText>
            {" Likes"}
          </ThemedText>
        </View>

        <View style={styles.actionBar}>
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
                  {likeCount}
                </ThemedText>
              )}
            </Pressable>
          </Animated.View>

          <Pressable onPress={handleShare} style={styles.actionBarBtn} accessibilityLabel="Share">
            <Ionicons name="arrow-up-outline" size={22} color="#71717A" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: "#000000",
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
  anonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  anonAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
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
  pressed: {
    opacity: 0.6,
  },
});
