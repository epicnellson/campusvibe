import { memo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, colors, lightColors } from "@/theme";
import type { MessageWithSender } from "@/services/database.types";

function messageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  return `${date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} ${time}`;
}

export type MessageBubbleProps = {
  message: MessageWithSender;
  isOwn: boolean;
};

function MessageBubbleInner({ message, isOwn }: MessageBubbleProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const otherBg = isDark ? "#2A2A2A" : "#E8E8E8";

  return (
    <ThemedView
      style={[styles.container, isOwn ? styles.ownContainer : { backgroundColor: otherBg, alignSelf: "flex-start", borderBottomLeftRadius: 4 }]}
    >
      {!isOwn && (
        <ThemedText style={[styles.sender, { color: isDark ? colors.textSecondary : lightColors.textSecondary }]}>
          {message.sender?.name ?? "Unknown"}
        </ThemedText>
      )}
      <ThemedText style={[styles.content, isOwn ? styles.ownText : { color: isDark ? colors.text : lightColors.text }]}>
        {message.content}
      </ThemedText>
      <ThemedText style={[styles.time, isOwn ? styles.ownTime : { color: isDark ? colors.textSecondary : lightColors.textSecondary }]}>
        {messageTime(message.created_at)}
      </ThemedText>
    </ThemedView>
  );
}

export const MessageBubble = memo(MessageBubbleInner);

const styles = StyleSheet.create({
  container: {
    maxWidth: "80%",
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: 2,
  },
  ownContainer: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  sender: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  content: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  ownText: {
    color: "#FFFFFF",
  },
  otherText: {
    color: colors.text,
  },
  time: {
    fontSize: fontSize.xs,
    alignSelf: "flex-end",
  },
  ownTime: {
    color: "rgba(255,255,255,0.6)",
  },
  otherTime: {
    color: colors.textSecondary,
  },
});
