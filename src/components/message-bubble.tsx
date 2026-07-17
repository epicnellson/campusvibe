import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
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
  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.ownContainer : styles.otherContainer,
      ]}
    >
      {!isOwn && (
        <ThemedText style={styles.sender}>
          {message.sender?.name ?? "Unknown"}
        </ThemedText>
      )}
      <ThemedText style={[styles.content, isOwn ? styles.ownText : styles.otherText]}>
        {message.content}
      </ThemedText>
      <ThemedText style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
        {messageTime(message.created_at)}
      </ThemedText>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleInner);

const styles = StyleSheet.create({
  container: {
    maxWidth: "78%",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 2,
    marginVertical: 2,
  },
  ownContainer: {
    alignSelf: "flex-end",
    backgroundColor: "#6C47FF",
    borderBottomRightRadius: 4,
  },
  otherContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#1A1A1E",
    borderBottomLeftRadius: 4,
  },
  sender: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  content: {
    fontSize: 15,
    lineHeight: 21,
  },
  ownText: {
    color: "#FFFFFF",
  },
  otherText: {
    color: "#E1E1E1",
  },
  time: {
    fontSize: 10,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  ownTime: {
    color: "rgba(255,255,255,0.5)",
  },
  otherTime: {
    color: "#71717A",
  },
});
