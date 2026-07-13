import { memo, useCallback, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import type { ConfessionWithLikes } from "@/services/database.types";

const ANIMALS = [
  "Panda", "Fox", "Owl", "Dolphin", "Tiger", "Koala", "Penguin",
  "Raccoon", "Sloth", "Hedgehog", "Otter", "Falcon", "Wolf", "Badger",
];

const EMOJI_OPTIONS = ["😂", "❤️", "😮", "😢", "😡", "🔥", "👏", "💀"];

function animalFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ANIMALS[Math.abs(hash) % ANIMALS.length];
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
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [showPicker, setShowPicker] = useState(false);
  const animalName = animalFromId(confession.id);

  const handleLike = useCallback(() => {
    onLikeToggled?.(confession.id, !userLiked);
  }, [confession.id, userLiked, onLikeToggled]);

  const addReaction = useCallback((emoji: string) => {
    setReactions((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] ?? 0) + 1,
    }));
    setShowPicker(false);
  }, []);

  const reactionEntries = Object.entries(reactions);

  return (
    <ThemedView style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
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

      {reactionEntries.length > 0 && (
        <View style={styles.reactionRow}>
          {reactionEntries.map(([emoji, count]) => (
            <Pressable
              key={emoji}
              onPress={() => addReaction(emoji)}
              style={styles.reactionBadge}
              accessibilityLabel={`${emoji} ${count}`}
              accessibilityRole="button"
            >
              <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
              <ThemedText style={styles.reactionCount}>{count}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setShowPicker(true)}
        style={styles.addReactionButton}
        accessibilityLabel="Add reaction"
        accessibilityRole="button"
      >
        <ThemedText style={styles.addReactionText}>Add Reaction (+)</ThemedText>
      </Pressable>

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

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <ThemedView style={styles.pickerSheet}>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => addReaction(emoji)}
                  style={({ pressed }) => [styles.emojiOption, pressed && styles.pressed]}
                  accessibilityLabel={emoji}
                  accessibilityRole="button"
                >
                  <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

export const ConfessionCard = memo(ConfessionCardInner);

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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6C47FF",
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
    color: "#E1E1E1",
    marginTop: spacing.xs + 2,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: borderRadius.md,
    resizeMode: "cover" as const,
    marginTop: spacing.sm,
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  reactionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  addReactionButton: {
    alignSelf: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6C47FF",
    borderStyle: "dashed",
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: spacing.xs,
    minHeight: 36,
  },
  addReactionText: {
    fontSize: 13,
    color: "#6C47FF",
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
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
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pickerSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(108, 71, 255, 0.08)",
  },
  emojiText: {
    fontSize: 26,
  },
});
