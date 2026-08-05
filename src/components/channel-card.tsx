import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Platform, Pressable, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { OnlineDot } from "@/components/chat/online-dot";
import { useTheme } from "@/hooks/use-theme";
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
  isCurrentUserLastSender?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  onPin?: () => void;
  onMute?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
  onMarkRead?: () => void;
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
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const isToday = d.toDateString() === now.toDateString();
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 6 && isToday) return `${diffHr}h ago`;
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
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

function getMessagePreview(
  messageType: string,
  lastMessage?: string,
  isCurrentUserLastSender?: boolean,
): string {
  let prefix = "";
  switch (messageType) {
    case "image":
      prefix = "📷 Photo";
      break;
    case "voice":
      prefix = "🎙️ Voice message";
      break;
    case "file":
      prefix = "📎 File";
      break;
    case "video":
      prefix = "📹 Video";
      break;
    default:
      prefix = lastMessage ?? "";
  }
  const userPrefix = isCurrentUserLastSender ? "You: " : "";
  return `${userPrefix}${prefix}`;
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
  isCurrentUserLastSender = false,
  isPinned = false,
  isMuted = false,
  isArchived = false,
  onPin,
  onMute,
  onArchive,
  onDelete,
  onLongPress,
  onMarkRead,
}: ChannelCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const name =
    displayName ??
    (channel.type === "dm" ? "Direct Message" : channel.name);
  const badge = unreadCount;
  const isDM = channel.type === "dm";
  const hasUnread = badge > 0;
  const showTicks = isCurrentUserLastSender && !hasUnread;

  const [menuVisible, setMenuVisible] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const lastDx = useRef(0);
  const swipeLeftThreshold = 80;
  const swipeRightThreshold = -80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const clamped = Math.min(Math.max(gesture.dx, -swipeLeftThreshold), -swipeRightThreshold);
        translateX.setValue(clamped);
        lastDx.current = gesture.dx;
      },
      onPanResponderRelease: () => {
        const useNative = Platform.OS !== "web";
        if (lastDx.current > swipeRightThreshold) {
          Animated.spring(translateX, {
            toValue: swipeRightThreshold,
            useNativeDriver: useNative,
            damping: 20,
            stiffness: 150,
          }).start();
          onArchive?.();
        } else if (lastDx.current < -swipeLeftThreshold) {
          Animated.spring(translateX, {
            toValue: swipeLeftThreshold,
            useNativeDriver: useNative,
            damping: 20,
            stiffness: 150,
          }).start();
          onPin?.();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: useNative,
            damping: 20,
            stiffness: 150,
          }).start();
        }
      },
    }),
  ).current;

  const resetSwipe = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: Platform.OS !== "web",
      damping: 20,
      stiffness: 150,
    }).start();
  }, [translateX]);

  const handleLongPress = useCallback(() => {
    setMenuVisible(true);
    onLongPress?.();
  }, [onLongPress]);

  const handleMarkRead = useCallback(() => {
    setMenuVisible(false);
    onMarkRead?.();
  }, [onMarkRead]);

  const handlePin = useCallback(() => {
    setMenuVisible(false);
    onPin?.();
    resetSwipe();
  }, [onPin, resetSwipe]);

  const handleMute = useCallback(() => {
    setMenuVisible(false);
    onMute?.();
  }, [onMute]);

  const handleArchive = useCallback(() => {
    setMenuVisible(false);
    onArchive?.();
    resetSwipe();
  }, [onArchive, resetSwipe]);

  const handleDelete = useCallback(() => {
    setMenuVisible(false);
    onDelete?.();
  }, [onDelete]);

  const previewText = getMessagePreview(messageType, lastMessage, isCurrentUserLastSender);
  const isEdited = lastMessage?.includes("(edited)") || messageType === "text" && lastMessage?.endsWith("edited");

  return (
    <View style={styles.wrapper}>
      <View style={styles.actionsBehind}>
        <View style={styles.rightActions}>
          <View style={[styles.actionBtn, styles.actionArchive]}>
            <Ionicons name="archive-outline" size={20} color="#FFF" />
            <Text style={styles.actionLabel}>Archive</Text>
          </View>
          <View style={[styles.actionBtn, styles.actionMute]}>
            <Ionicons name="notifications-off-outline" size={20} color="#FFF" />
            <Text style={styles.actionLabel}>Mute</Text>
          </View>
        </View>
        <View style={styles.leftActions}>
          <View style={[styles.actionBtn, styles.actionPin]}>
            <Ionicons name="pin-outline" size={20} color="#FFF" />
            <Text style={styles.actionLabel}>Pin</Text>
          </View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.cardContainer,
          isArchived && styles.cardArchived,
          isMuted && styles.cardMuted,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={onPress}
          onLongPress={handleLongPress}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
          accessibilityLabel={`Open ${name} conversation`}
          accessibilityRole="button"
        >
          <View style={styles.avatarWrap}>
            {isDM ? (
              <Avatar uri={avatarUrl} name={name} size={52} style={styles.avatarRing} />
            ) : (
              <View style={styles.channelIcon}>
                <Ionicons name={channelIcon(channel.type)} size={22} color={theme.muted} />
              </View>
            )}
            {isDM && isOnline && <OnlineDot size={13} />}
          </View>

          <View style={styles.content}>
            <View style={styles.topRow}>
              {isPinned && (
                <Ionicons name="pin" size={13} color={theme.primary} style={styles.pinIcon} />
              )}
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
                  color={theme.primary}
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
              <View style={styles.previewCol}>
                {isTyping ? (
                  <ThemedText style={styles.typingText} numberOfLines={1}>
                    typing...
                  </ThemedText>
                ) : (
                  <ThemedText
                    style={[
                      styles.preview,
                      hasUnread && styles.previewUnread,
                      isMuted && styles.previewMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {previewText}
                    {isEdited && (
                      <ThemedText style={styles.editedText}> edited</ThemedText>
                    )}
                  </ThemedText>
                )}
              </View>
              {hasUnread ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              ) : showTicks ? (
                <Ionicons name="checkmark-done" size={14} color={theme.primary} style={styles.readTicks} />
              ) : null}
            </View>
          </View>
        </Pressable>
      </Animated.View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <ThemedText style={styles.sheetTitle}>{name}</ThemedText>

            <Pressable style={styles.menuItem} onPress={handleMarkRead}>
              <Ionicons name={hasUnread ? "checkmark-done-outline" : "mail-open-outline"} size={20} color={theme.text} />
              <ThemedText style={styles.menuItemText}>
                {hasUnread ? "Mark as Read" : "Mark as Unread"}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={handlePin}>
              <Ionicons name={isPinned ? "pin" : "pin-outline"} size={20} color={theme.text} />
              <ThemedText style={styles.menuItemText}>
                {isPinned ? "Unpin" : "Pin"}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={handleMute}>
              <Ionicons name={isMuted ? "notifications-off" : "notifications-off-outline"} size={20} color={theme.text} />
              <ThemedText style={styles.menuItemText}>
                {isMuted ? "Unmute" : "Mute"}
              </ThemedText>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={handleArchive}>
              <Ionicons name={isArchived ? "archive" : "archive-outline"} size={20} color={theme.text} />
              <ThemedText style={styles.menuItemText}>
                {isArchived ? "Unarchive" : "Archive"}
              </ThemedText>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
              <ThemedText style={[styles.menuItemText, styles.deleteText]}>
                Delete Chat
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: {
      position: "relative",
      overflow: "visible",
    },
    actionsBehind: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      zIndex: 0,
    },
    rightActions: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: "auto",
    },
    leftActions: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: "auto",
    },
    actionBtn: {
      width: 72,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    actionArchive: {
      backgroundColor: theme.warning,
    },
    actionMute: {
      backgroundColor: theme.muted,
    },
    actionPin: {
      backgroundColor: theme.primary,
    },
    actionLabel: {
      color: "#FFF",
      fontSize: 11,
      fontWeight: "600",
    },
    cardContainer: {
      zIndex: 1,
      backgroundColor: theme.background,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
    },
    cardArchived: {
      opacity: 0.6,
    },
    cardMuted: {
      opacity: 0.75,
    },
    pressed: {
      opacity: 0.6,
    },
    avatarWrap: {
      position: "relative",
      width: 52,
      height: 52,
    },
    avatarRing: {
      borderWidth: 1,
      borderColor: theme.border,
    },
    channelIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.border,
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
      fontWeight: "600",
      color: theme.text,
      flexShrink: 1,
    },
    nameUnread: {
      fontWeight: "800",
    },
    pinIcon: {
      marginRight: 4,
    },
    verifiedBadge: {
      marginLeft: 4,
    },
    spacer: {
      flex: 1,
    },
    time: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    timeUnread: {
      color: theme.primary,
      fontWeight: "700",
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    previewCol: {
      flex: 1,
    },
    preview: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 19,
    },
    previewUnread: {
      color: theme.text,
      fontWeight: "500",
    },
    previewMuted: {
      opacity: 0.7,
    },
    editedText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontStyle: "italic",
    },
    typingText: {
      fontSize: 14,
      color: theme.primary,
      fontStyle: "italic",
    },
    badge: {
      backgroundColor: theme.primary,
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
    readTicks: {
      marginLeft: 8,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: theme.overlay,
    },
    sheet: {
      backgroundColor: theme.backgroundElement,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 34,
      paddingTop: 8,
      paddingHorizontal: 16,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.borderLight,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 16,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 12,
    },
    menuItemText: {
      fontSize: 16,
      color: theme.text,
    },
    menuDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    deleteText: {
      color: theme.error,
    },
  });
}

export const ChannelCard = memo(ChannelCardInner);
