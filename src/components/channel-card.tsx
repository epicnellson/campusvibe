import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { OnlineDot } from "@/components/chat/online-dot";
import type { Channel } from "@/services/database.types";

export type ChannelCardProps = {
  channel: Channel & { members: { user_id: string }[] };
  displayName?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  isTyping?: boolean;
  lastMessage?: string;
  messageType?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  onPress: () => void;
};

function formatTime(dateStr?: string | any): string {
  if (!dateStr) return "";
  try {
    let d: Date;
    if (typeof dateStr === "object" && dateStr?.seconds) {
      d = new Date(dateStr.seconds * 1000);
    } else if (typeof dateStr === "number") {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function channelIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "general":
      return "megaphone-outline";
    case "department":
      return "school-outline";
    case "hostel":
      return "home-outline";
    default:
      return "chatbubbles-outline";
  }
}

function ChannelCardInner({
  channel,
  displayName,
  avatarUrl,
  isOnline = false,
  isVerified = false,
  isTyping = false,
  lastMessage,
  messageType = "text",
  lastMessageTime,
  unreadCount = 0,
  onPress,
}: ChannelCardProps) {
  const name =
    displayName ??
    (channel.type === "dm" ? "Direct Message" : channel.name);
  const badge = unreadCount;
  const isDM = channel.type === "dm";
  const hasUnread = badge > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Open ${name} conversation`}
      accessibilityRole="button"
    >
      <View style={styles.avatarWrap}>
        {isDM ? (
          <Avatar uri={avatarUrl} name={name} size={52} />
        ) : (
          <View style={styles.channelIcon}>
            <Ionicons name={channelIcon(channel.type)} size={22} color="#71717A" />
          </View>
        )}
        {isDM && isOnline && <OnlineDot size={13} />}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <ThemedText
            style={[styles.name, hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {name}
          </ThemedText>
          {isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color="#6C47FF"
              style={styles.verifiedBadge}
            />
          )}
          <View style={styles.spacer} />
          {lastMessageTime && (
            <ThemedText
              style={[styles.time, hasUnread && styles.timeUnread]}
            >
              {formatTime(lastMessageTime)}
            </ThemedText>
          )}
        </View>

        <View style={styles.bottomRow}>
          {isTyping ? (
            <ThemedText style={styles.typingText} numberOfLines={1}>
              typing...
            </ThemedText>
          ) : (
            (() => {
              const prefix = messageType === "image" ? "\uD83D\uDCF7 " : messageType === "voice" ? "\uD83C\uDF99\uFE0F " : messageType === "file" ? "\uD83D\uDCCE " : "";
              const text = lastMessage ? `${prefix}${lastMessage}` : isDM ? "Start a conversation" : `${channel.members?.length ?? 0} members`;
              return (
                <ThemedText
                  style={[styles.preview, hasUnread && styles.previewUnread]}
                  numberOfLines={1}
                >
                  {text}
                </ThemedText>
              );
            })()
          )}
          {badge > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>
                {badge > 99 ? "99+" : badge}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const ChannelCard = memo(ChannelCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  avatarWrap: {
    position: "relative",
    width: 52,
    height: 52,
  },
  channelIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E",
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "500",
    color: "#A1A1A6",
    flexShrink: 1,
  },
  nameUnread: {
    fontWeight: "700",
    color: "#FFFFFF",
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  spacer: {
    flex: 1,
  },
  time: {
    fontSize: 13,
    color: "#71717A",
    marginLeft: 8,
  },
  timeUnread: {
    color: "#6C47FF",
    fontWeight: "700",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  preview: {
    fontSize: 14,
    color: "#71717A",
    flex: 1,
    lineHeight: 19,
  },
  previewUnread: {
    color: "#A1A1A6",
  },
  typingText: {
    fontSize: 14,
    color: "#6C47FF",
    fontStyle: "italic",
    flex: 1,
  },
  badge: {
    backgroundColor: "#6C47FF",
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 16,
  },
});
