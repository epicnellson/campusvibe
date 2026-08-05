import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { VoiceMessagePlayer } from "@/components/chat/voice-message-player";
import { useTheme } from "@/hooks/use-theme";
import type { MessageWithSender, MessageType } from "@/services/database.types";
import { markViewOnce } from "@/services/chats";

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, "0");
  return `#${full}${a}`;
}

function formatBubbleTime(dateStr: string | number | any): string {
  try {
    if (!dateStr) return "";
    let d: Date;
    if (typeof dateStr === "object" && dateStr?.seconds) {
      d = new Date(dateStr.seconds * 1000);
    } else if (typeof dateStr === "number") {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ReadStatus = "sending" | "sent" | "delivered" | "seen";

export type MessageBubbleProps = {
  message: MessageWithSender;
  isOwn: boolean;
  isHighlighted?: boolean;
  isGrouped?: boolean;
  readStatus?: ReadStatus;
  onLongPress?: (message: MessageWithSender) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onReply?: (message: MessageWithSender) => void;
  currentUserId?: string;
  onViewImage?: (url: string) => void;
};

function ReadCheck({ status }: { status: ReadStatus }) {
  const theme = useTheme();
  if (status === "sending") {
    return <Ionicons name="time-outline" size={13} color={theme.textTertiary} />;
  }
  if (status === "delivered") {
    return <Ionicons name="checkmark" size={13} color={theme.primaryLight} />;
  }
  if (status === "seen") {
    return <Ionicons name="checkmark-done" size={14} color={theme.primary} />;
  }
  return <Ionicons name="checkmark" size={13} color={theme.textTertiary} />;
}

function ViewOnceContent({ message, isOwn, onOpen }: {
  message: MessageWithSender;
  isOwn: boolean;
  onOpen?: () => void;
}) {
  const theme = useTheme();
  const [viewed, setViewed] = useState(!!(message as any).viewed);

  const handleView = useCallback(async () => {
    if (viewed) return;
    try {
      await markViewOnce(message.id);
      setViewed(true);
      onOpen?.();
    } catch {
      setViewed(true);
    }
  }, [message.id, viewed, onOpen]);

  const ownMuted = withAlpha("#FFFFFF", 0.55);
  const otherMuted = theme.textSecondary;

  if (viewed) {
    return (
      <View style={styles.viewOnceOpened}>
        <Ionicons name="eye-off-outline" size={16} color={isOwn ? ownMuted : otherMuted} />
        <ThemedText style={[styles.viewOnceOpenedText, { color: isOwn ? ownMuted : otherMuted }]}>
          Opened
        </ThemedText>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handleView}
      style={[styles.viewOnceBtn, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.15) : theme.backgroundElement }]}
    >
      <Ionicons name="eye-outline" size={20} color={isOwn ? "#FFFFFF" : theme.primary} />
      <ThemedText style={[styles.viewOnceBtnText, { color: isOwn ? "#FFFFFF" : theme.primary }]}>
        Tap to view once
      </ThemedText>
    </Pressable>
  );
}

function MessageBubbleInner({
  message,
  isOwn,
  isHighlighted,
  isGrouped = false,
  readStatus = "delivered",
  onLongPress,
  onReaction,
  onReply,
  currentUserId,
  onViewImage,
}: MessageBubbleProps) {
  const theme = useTheme();

  const handleLongPress = useCallback(() => {
    onLongPress?.(message);
  }, [message, onLongPress]);

  const handleReply = useCallback(() => {
    onReply?.(message);
  }, [message, onReply]);

  // Double-tap heart
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      onReaction?.(message.id, "❤️");
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [message.id, onReaction]);

  // Sending shimmer
  const shimmerOpacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (readStatus !== "sending") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(shimmerOpacity, { toValue: 0.4, duration: 600, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [readStatus]);

  const msgType = (message as any).type as MessageType | undefined;

  const bubbleStyles = [
    styles.bubble,
    isOwn ? [styles.ownBubble, { backgroundColor: theme.primary }] : [styles.otherBubble, { backgroundColor: theme.inputBg }],
    isHighlighted && { borderColor: theme.warning },
    isGrouped && styles.groupedMessage,
    msgType === "image" && styles.imageBubble,
    msgType === "file" && styles.fileBubble,
    readStatus === "sending" && { opacity: shimmerOpacity as any },
  ];

  // Swipe-to-reply via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 50) {
          handleReply();
        }
      },
    })
  ).current;
  const mediaUrl = (message as any).media_url as string | undefined;
  const fileName = (message as any).file_name as string | undefined;
  const fileSize = (message as any).file_size as number | undefined;

  const reactions = (message as any).reactions as Record<string, string> | undefined;
  const groupedReactions: Record<string, { count: number; hasOwn: boolean }> = {};
  if (reactions) {
    for (const [uid, emoji] of Object.entries(reactions)) {
      if (!groupedReactions[emoji]) groupedReactions[emoji] = { count: 0, hasOwn: false };
      groupedReactions[emoji].count++;
      if (uid === currentUserId) groupedReactions[emoji].hasOwn = true;
    }
  }
  const reactionEntries = Object.entries(groupedReactions);
  const hasReactions = reactionEntries.length > 0;

  const replyTo = (message as any).replyToMessage as MessageWithSender | undefined;
  const voiceUrl = (message as any).voice_url as string | undefined;
  const voiceDuration = (message as any).voice_duration as number | undefined;
  const isEdited = (message as any).edited as boolean;

  const ownMuted = withAlpha("#FFFFFF", 0.55);
  const otherMuted = theme.textSecondary;
  const ownTextColor = "#FFFFFF";
  const otherTextColor = theme.text;

  const replyBlock = replyTo ? (
    <View style={[styles.replyBlock, { backgroundColor: withAlpha(theme.textSecondary, 0.12) }]}>
      <View style={[styles.replyBar, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.5) : theme.primary }]} />
      <View style={styles.replyContent}>
        <ThemedText style={[styles.replyName, { color: isOwn ? "#FFFFFF" : theme.primary }]} numberOfLines={1}>
          {replyTo.sender?.name ?? "Unknown"}
        </ThemedText>
        <ThemedText style={[styles.replyText, { color: isOwn ? withAlpha("#FFFFFF", 0.75) : theme.textSecondary }]} numberOfLines={1}>
          {replyTo.content}
        </ThemedText>
      </View>
    </View>
  ) : null;

  const senderName = !isOwn && !isGrouped ? (
    <ThemedText style={[styles.senderName, { color: theme.primary }]}>
      {message.sender?.name ?? "Unknown"}
    </ThemedText>
  ) : null;

  let body: ReactNode;
  if (msgType === "view_once") {
    body = <ViewOnceContent message={message} isOwn={isOwn} />;
  } else if (msgType === "voice" && voiceUrl) {
    body = <VoiceMessagePlayer url={voiceUrl} isOwn={isOwn} duration={voiceDuration ?? 0} />;
  } else if (msgType === "image" && mediaUrl) {
    body = (
      <Pressable onPress={() => onViewImage?.(mediaUrl)}>
        <Image
          source={{ uri: mediaUrl }}
          style={styles.chatImage}
          contentFit="cover"
          transition={200}
        />
        {message.content && message.content !== "📷 Photo" && (
          <ThemedText style={[styles.content, { color: isOwn ? ownTextColor : otherTextColor }, { paddingHorizontal: 4, paddingTop: 4 }]}>
            {message.content}
          </ThemedText>
        )}
      </Pressable>
    );
  } else if (msgType === "file") {
    body = (
      <View style={styles.fileContainer}>
        <View style={[styles.fileIcon, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.15) : theme.backgroundElement }]}>
          <Ionicons name="document-text-outline" size={24} color={isOwn ? "#FFFFFF" : theme.primary} />
        </View>
        <View style={styles.fileInfo}>
          <ThemedText style={[styles.fileName, { color: isOwn ? "#FFFFFF" : theme.text }]} numberOfLines={1}>
            {fileName || "File"}
          </ThemedText>
          {fileSize && (
            <ThemedText style={[styles.fileSize, { color: isOwn ? withAlpha("#FFFFFF", 0.6) : theme.textSecondary }]}>
              {formatFileSize(fileSize)}
            </ThemedText>
          )}
        </View>
      </View>
    );
  } else {
    body = (
      <ThemedText style={[styles.content, { color: isOwn ? ownTextColor : otherTextColor }]}>
        {message.content}
      </ThemedText>
    );
  }

  return (
    <View style={[styles.wrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]} {...panResponder.panHandlers}>
      <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
        <Pressable
          onPress={handleDoubleTap}
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={bubbleStyles}
        >
          {replyBlock}
          {senderName}
          {body}
        </Pressable>

        {hasReactions && (
          <View style={[styles.reactionDock, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {reactionEntries.map(([emoji, { count, hasOwn }]) => (
              <Pressable
                key={emoji}
                onPress={() => onReaction?.(message.id, emoji)}
                style={styles.reactionItem}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {count > 1 && (
                  <ThemedText style={[styles.reactionCount, { color: hasOwn ? theme.primary : theme.textSecondary }]}>
                    {count}
                  </ThemedText>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.metaRow, isOwn ? styles.metaOwn : styles.metaOther, hasReactions && { marginTop: 14 }]}>
        <ThemedText style={[styles.time, { color: isOwn ? theme.textTertiary : theme.textSecondary }]}>
          {formatBubbleTime(message.created_at)}
        </ThemedText>
        {isEdited && (
          <ThemedText style={[styles.edited, { color: isOwn ? theme.textTertiary : theme.textSecondary }]}>
            edited
          </ThemedText>
        )}
        {isOwn && <ReadCheck status={readStatus} />}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleInner);

const styles = StyleSheet.create({
  wrapper: { marginVertical: 0, width: "100%", alignSelf: "stretch" },
  ownWrapper: { alignItems: "flex-end" },
  otherWrapper: { alignItems: "flex-start" },
  bubbleWrap: { position: "relative", maxWidth: "80%" },
  bubbleWrapOwn: { alignSelf: "flex-end" },
  bubbleWrapOther: { alignSelf: "flex-start" },
  bubble: {
    maxWidth: "100%",
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  ownBubble: { borderBottomRightRadius: 4 },
  otherBubble: { borderBottomLeftRadius: 4 },
  groupedMessage: { marginTop: -2 },
  imageBubble: { padding: 4, overflow: "hidden", borderRadius: 16 },
  fileBubble: { padding: 4 },
  highlighted: { borderWidth: 2 },
  senderName: { fontSize: 12, fontWeight: "700", marginBottom: 2, paddingHorizontal: 8 },
  content: { fontSize: 15, lineHeight: 21 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  metaOwn: { alignSelf: "flex-end" },
  metaOther: { alignSelf: "flex-start" },
  time: { fontSize: 10, lineHeight: 14 },
  readRow: { alignItems: "center", justifyContent: "center" },
  chatImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 180,
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 14, fontWeight: "500", lineHeight: 18 },
  fileSize: { fontSize: 11, lineHeight: 14 },
  viewOnceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    minWidth: 150,
  },
  viewOnceBtnText: { fontSize: 14, fontWeight: "500" },
  viewOnceOpened: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  viewOnceOpenedText: { fontSize: 13, fontStyle: "italic" },
  replyBlock: {
    flexDirection: "row", marginBottom: 6, gap: 6, padding: 6,
    borderRadius: 8,
  },
  replyBar: { width: 3, borderRadius: 1.5 },
  replyContent: { flex: 1, gap: 1 },
  replyName: { fontSize: 11, fontWeight: "700" },
  replyText: { fontSize: 12, lineHeight: 16 },
  reactionDock: {
    position: "absolute",
    bottom: -10,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, fontWeight: "600" },
  edited: { fontSize: 10, fontStyle: "italic" },
});
