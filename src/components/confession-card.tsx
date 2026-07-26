import { memo, useCallback, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ResponsiveImage } from "@/components/responsive-image";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { resolveImageUrl } from "@/services/storage";
import { deleteConfession } from "@/services/confessions";
import { submitReport } from "@/services/reports";
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
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ANIMALS[Math.abs(hash) % ANIMALS.length];
}

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
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
  accessibilityRole,
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

export type ConfessionCardProps = {
  confession: ConfessionWithLikes;
  onLikeToggled?: (confessionId: string, liked: boolean) => void;
  onConfessionDeleted?: (confessionId: string) => void;
};

function ConfessionCardInner({ confession, onLikeToggled, onConfessionDeleted }: ConfessionCardProps) {
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const currentUserId = session?.user?.id;
  const userLiked =
    confession.confession_likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = confession.confession_likes?.length ?? 0;
  const [reportVisible, setReportVisible] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const animalName = animalFromId(confession.id);
  const avatarColor = colorFromId(confession.id);

  const handleLike = useCallback(() => {
    onLikeToggled?.(confession.id, !userLiked);
  }, [confession.id, userLiked, onLikeToggled]);

  const resolvedImage = resolveImageUrl(confession.image_url, "post-images");

  const handleCopyText = useCallback(async () => {
    await Clipboard.setStringAsync(confession.content);
    setShowMenu(false);
  }, [confession.content]);

  const handleReport = useCallback(async () => {
    try {
      await submitReport(confession.id, "confession", "Other");
    } catch {}
    setShowMenu(false);
    setShowImageViewer(false);
  }, [confession.id]);

  const handleShare = useCallback(async () => {
    setShowMenu(false);
    setShowImageViewer(false);
    try {
      await Share.share({ message: confession.content });
    } catch {}
  }, [confession.content]);

  const handleDeleteConfession = useCallback(async () => {
    setShowMenu(false);
    try {
      await deleteConfession(confession.id);
      setShowImageViewer(false);
      onConfessionDeleted?.(confession.id);
    } catch {
      Alert.alert("Error", "Could not delete confession. Please try again.");
    }
  }, [confession.id, onConfessionDeleted]);

  const isOwnPost = confession.user_id === currentUserId;

  const menuItems: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string }[] = [
    { label: "Copy text", icon: "copy-outline", onPress: handleCopyText },
    { label: "Share", icon: "share-outline", onPress: handleShare },
    { label: "Report", icon: "flag-outline", onPress: handleReport },
  ];
  if (isOwnPost) {
    menuItems.push({
      label: "Delete confession",
      icon: "trash-outline",
      onPress: handleDeleteConfession,
      color: colors.danger,
    });
  }

  return (
    <View style={[styles.container, { borderBottomColor: colors.divider, backgroundColor: colors.background }]}>
      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <ThemedText style={styles.avatarText}>?</ThemedText>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.headerRow}>
            <ThemedText style={[styles.authorName, { color: colors.text }]}>
              Anonymous {animalName}
            </ThemedText>
            <ThemedText style={[styles.dot, { color: colors.inputBorder }]}>·</ThemedText>
            <ThemedText style={[styles.timestamp, { color: colors.muted }]}>
              {relativeTime(confession.created_at)}
            </ThemedText>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setShowMenu(true)}
              style={{ padding: 4 }}
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.muted} />
            </Pressable>
          </View>

          <ThemedText style={[styles.body, { color: colors.warmInverse }]}>{confession.content}</ThemedText>

          {resolvedImage ? (
            <Pressable
              onPress={() => setShowImageViewer(true)}
              style={[styles.imagePressable, { backgroundColor: colors.background }]}
            >
              <ResponsiveImage
                source={resolvedImage}
                borderRadius={14}
              />
            </Pressable>
          ) : null}

          <View style={styles.actionRow}>
            <AnimatedActionButton
              onPress={handleLike}
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

            <View style={{ flex: 1 }} />

            <AnimatedActionButton
              onPress={() => setReportVisible(true)}
              accessibilityLabel="Report"
            >
              <Ionicons name="flag-outline" size={16} color={colors.muted} />
            </AnimatedActionButton>
          </View>
        </View>
      </View>

      <ReportModal
        visible={reportVisible}
        contentId={confession.id}
        contentType="confession"
        onClose={() => setReportVisible(false)}
      />

      {/* Fullscreen image viewer */}
      <Modal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageViewer(false)}
      >
        <View style={[styles.viewerOverlay, { backgroundColor: colors.background }]}>
          <Pressable
            onPress={() => setShowImageViewer(false)}
            style={[styles.viewerClose, { top: insets.top + 12, backgroundColor: colors.backgroundElement }]}
            accessibilityLabel="Close image"
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => setShowMenu(true)}
            style={[styles.viewerMenuBtn, { top: insets.top + 12, backgroundColor: colors.backgroundElement }]}
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.viewerImageContainer}>
            <Image
              source={{ uri: resolvedImage ?? "" }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>

      {/* 3-dot action sheet */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowMenu(false)}>
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
    </View>
  );
}

export const ConfessionCard = memo(ConfessionCardInner);

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
  rightColumn: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
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
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 4,
  },
  imagePressable: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    minHeight: 200,
    borderRadius: 14,
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
  pressed: {
    opacity: 0.6,
  },
  viewerOverlay: {
    ...(StyleSheet.absoluteFill as object),
  },
  viewerClose: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  viewerMenuBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  viewerImageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
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
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
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
});
