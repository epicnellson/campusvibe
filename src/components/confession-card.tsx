import { memo, useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize } from "@/theme";
import { useSession } from "@/hooks/use-session";
import type { ConfessionWithLikes } from "@/services/database.types";

const ANIMALS = [
  "Panda", "Fox", "Owl", "Dolphin", "Tiger", "Koala", "Penguin",
  "Raccoon", "Sloth", "Hedgehog", "Otter", "Falcon", "Wolf", "Badger",
];

const REACTIONS = [
  { emoji: "😂", key: "laugh" },
  { emoji: "❤️", key: "heart" },
  { emoji: "😮", key: "wow" },
  { emoji: "😢", key: "sad" },
  { emoji: "😡", key: "angry" },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function hueFromId(id: string): number {
  return hashString(id) % 360;
}

function animalFromId(id: string): string {
  return ANIMALS[hashString(id) % ANIMALS.length];
}

function hexFromHue(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; b = 0; }
  else if (hue < 120) { r = x; g = c; b = 0; }
  else if (hue < 180) { r = 0; g = c; b = x; }
  else if (hue < 240) { r = 0; g = x; b = c; }
  else if (hue < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

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
  const [reactions, setReactions] = useState<Record<string, boolean>>({});

  const hue = hueFromId(confession.id);
  const cardBg = hexFromHue(hue, 30, 92);
  const avatarBg = hexFromHue(hue, 55, 45);
  const animalName = animalFromId(confession.id);

  const toggleReaction = useCallback((key: string) => {
    setReactions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleLike = useCallback(() => {
    if (userLiked) {
      onLikeToggled?.(confession.id, false);
    } else {
      onLikeToggled?.(confession.id, true);
    }
  }, [confession.id, userLiked, onLikeToggled]);

  return (
    <ThemedView style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <ThemedText style={styles.avatarText}>?</ThemedText>
        </View>
        <View style={styles.meta}>
          <ThemedText type="smallBold">Anonymous {animalName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {relativeTime(confession.created_at)}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.content}>{confession.content}</ThemedText>

      {confession.image_url ? (
        <Image source={{ uri: confession.image_url }} style={styles.image} />
      ) : null}

      <View style={styles.reactionRow}>
        {REACTIONS.map((r) => {
          const active = !!reactions[r.key];
          return (
            <Pressable
              key={r.key}
              onPress={() => toggleReaction(r.key)}
              style={({ pressed }) => [
                styles.reactionButton,
                active && styles.reactionActive,
                pressed && styles.pressed,
              ]}
              accessibilityLabel={`${r.key} reaction`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <ThemedText style={styles.reactionEmoji}>{r.emoji}</ThemedText>
              <ThemedText
                type="small"
                style={[styles.reactionCount, active && styles.reactionCountActive]}
              >
                {active ? "1" : "0"}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleLike}
          style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]}
          accessibilityLabel={userLiked ? "Unlike this confession" : "Like this confession"}
          accessibilityRole="button"
          accessibilityState={{ selected: userLiked }}
        >
          <ThemedText style={userLiked ? styles.likedIcon : styles.likeIcon}>
            {userLiked ? "♥" : "♡"}
          </ThemedText>
          <ThemedText
            type="small"
            style={userLiked ? { color: "#FF3B30" } : undefined}
            themeColor={userLiked ? undefined : "textSecondary"}
          >
            {likeCount}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setReportVisible(true)}
          style={({ pressed }) => [pressed && styles.pressed, styles.reportButton]}
          accessibilityLabel="Report this confession"
          accessibilityRole="button"
        >
          <ThemedText type="small" themeColor="textSecondary">
            Report
          </ThemedText>
        </Pressable>
      </View>

      <ReportModal
        visible={reportVisible}
        contentId={confession.id}
        contentType="confession"
        onClose={() => setReportVisible(false)}
      />
    </ThemedView>
  );
}

export const ConfessionCard = memo(ConfessionCardInner);

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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  meta: {
    gap: 2,
  },
  content: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: borderRadius.md,
    resizeMode: "cover" as const,
  },
  reactionRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D0D0D0",
    minHeight: 44,
  },
  reactionActive: {
    borderColor: "#6C47FF",
    backgroundColor: "rgba(108, 71, 255, 0.08)",
  },
  reactionEmoji: {
    fontSize: 15,
  },
  reactionCount: {
    color: "#666",
  },
  reactionCountActive: {
    color: "#6C47FF",
    fontWeight: "600",
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
    color: "#FF3B30",
  },
});
