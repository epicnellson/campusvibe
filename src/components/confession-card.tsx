import { memo, useCallback, useState, useRef } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { useSession } from "@/hooks/use-session";
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

export type ConfessionCardProps = {
  confession: ConfessionWithLikes;
  onLikeToggled?: (confessionId: string, liked: boolean) => void;
};

function ConfessionCardInner({ confession, onLikeToggled }: ConfessionCardProps) {
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const userLiked =
    confession.confession_likes?.some((l) => l.user_id === currentUserId) ?? false;
  const likeCount = confession.confession_likes?.length ?? 0;
  const [reportVisible, setReportVisible] = useState(false);
  const animalName = animalFromId(confession.id);
  const avatarColor = colorFromId(confession.id);

  const handleLike = useCallback(() => {
    onLikeToggled?.(confession.id, !userLiked);
  }, [confession.id, userLiked, onLikeToggled]);

  const resolvedImage = resolveImageUrl(confession.image_url, "post-images");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/confession/[id]", params: { id: confession.id } })}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.85 }]}
      accessibilityLabel={`Confession by Anonymous ${animalName}`}
      accessibilityRole="button"
    >
      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <ThemedText style={styles.avatarText}>?</ThemedText>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.authorName}>
              Anonymous {animalName}
            </ThemedText>
            <ThemedText style={styles.dot}>·</ThemedText>
            <ThemedText style={styles.timestamp}>
              {relativeTime(confession.created_at)}
            </ThemedText>
          </View>

          <ThemedText style={styles.body}>{confession.content}</ThemedText>

          {resolvedImage ? (
            <Image
              source={{ uri: resolvedImage }}
              style={styles.postImage}
              resizeMode="contain"
            />
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
                color={userLiked ? "#E0245E" : "#71717A"}
              />
              {likeCount > 0 && (
                <ThemedText
                  style={[
                    styles.actionCount,
                    { color: userLiked ? "#FF3B30" : "#71717A" },
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
              <Ionicons name="flag-outline" size={16} color="#71717A" />
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
    </Pressable>
  );
}

export const ConfessionCard = memo(ConfessionCardInner);

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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
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
    color: "#FFFFFF",
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
