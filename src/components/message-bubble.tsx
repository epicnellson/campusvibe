import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { ThemedText } from "@/components/themed-text";
import type { MessageWithSender, MessageType } from "@/services/database.types";
import { markViewOnce } from "@/services/chats";

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
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

export type ReadStatus = "sent" | "delivered" | "seen";

export type MessageBubbleProps = {
  message: MessageWithSender;
  isOwn: boolean;
  isHighlighted?: boolean;
  isGrouped?: boolean;
  readStatus?: ReadStatus;
  onLongPress?: (message: MessageWithSender) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  currentUserId?: string;
  onViewImage?: (url: string) => void;
};

function ReadCheck({ status }: { status: ReadStatus }) {
  const color =
    status === "seen" ? "#34C759" : status === "delivered" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)";
  return (
    <View style={styles.readRow}>
      <Ionicons
        name={status === "sent" ? "checkmark" : "checkmark-done"}
        size={14}
        color={color}
      />
    </View>
  );
}

function VoicePlayer({ url, isOwn, duration }: { url: string; isOwn: boolean; duration: number }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [durationMs, setDurationMs] = useState(duration * 1000);
  const positionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadSound = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false }
        );
        if (!mounted) {
          newSound.unloadAsync();
          return;
        }
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            positionRef.current = 0;
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          } else {
            setPosition(status.positionMillis);
            positionRef.current = status.positionMillis;
            setDurationMs(status.durationMillis ?? duration * 1000);
          }
        });
        setSound(newSound);
      } catch (e) {
        console.warn("Failed to load voice:", e);
      }
    };
    loadSound();
    return () => {
      mounted = false;
      sound?.unloadAsync();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [url]);

  const togglePlay = useCallback(async () => {
    if (!sound) return;
    try {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn("Playback error:", e);
    }
  }, [sound, isPlaying]);

  const totalDur = durationMs || duration * 1000;
  const progress = totalDur > 0 ? position / totalDur : 0;
  const progressPct = Math.min(100, Math.max(0, progress * 100));
  const elapsed = Math.floor(position / 1000);
  const total = Math.floor(totalDur / 1000);
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;
  const totalLabel = `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;

  return (
    <Pressable onPress={togglePlay} style={styles.voiceContainer}>
      <View style={[styles.playBtn, { backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : "rgba(108,71,255,0.15)" }]}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={20}
          color={isOwn ? "#FFFFFF" : "#6C47FF"}
          style={isPlaying ? undefined : { marginLeft: 2 }}
        />
      </View>
      <View style={styles.voiceInfo}>
        <View style={[styles.voiceBar, { backgroundColor: isOwn ? "rgba(255,255,255,0.2)" : "#2A2A2A" }]}>
          <View
            style={[
              styles.voiceProgress,
              {
                width: `${progressPct}%`,
                backgroundColor: isOwn ? "#FFFFFF" : "#6C47FF",
              },
            ]}
          />
          {isPlaying && (
            <View
              style={[
                styles.voiceDot,
                {
                  left: `${progressPct}%`,
                  backgroundColor: isOwn ? "#FFFFFF" : "#6C47FF",
                },
              ]}
            />
          )}
        </View>
        <ThemedText style={[styles.voiceTime, { color: isOwn ? "rgba(255,255,255,0.5)" : "#71717A" }]}>
          {isPlaying ? elapsedLabel : totalLabel}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function ViewOnceContent({ message, isOwn, onOpen }: {
  message: MessageWithSender;
  isOwn: boolean;
  onOpen?: () => void;
}) {
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

  if (viewed) {
    return (
      <View style={styles.viewOnceOpened}>
        <Ionicons name="eye-off-outline" size={16} color={isOwn ? "rgba(255,255,255,0.5)" : "#71717A"} />
        <ThemedText style={[styles.viewOnceOpenedText, { color: isOwn ? "rgba(255,255,255,0.5)" : "#71717A" }]}>
          Opened
        </ThemedText>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handleView}
      style={[styles.viewOnceBtn, isOwn ? { backgroundColor: "rgba(255,255,255,0.15)" } : { backgroundColor: "#2A2A2A" }]}
    >
      <Ionicons name="eye-outline" size={20} color={isOwn ? "#FFFFFF" : "#6C47FF"} />
      <ThemedText style={[styles.viewOnceBtnText, { color: isOwn ? "#FFFFFF" : "#6C47FF" }]}>
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
  currentUserId,
  onViewImage,
}: MessageBubbleProps) {
  const handleLongPress = useCallback(() => {
    onLongPress?.(message);
  }, [message, onLongPress]);

  const msgType = (message as any).type as MessageType | undefined;
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

  const replyTo = (message as any).replyToMessage as MessageWithSender | undefined;
  const voiceUrl = (message as any).voice_url as string | undefined;
  const voiceDuration = (message as any).voice_duration as number | undefined;
  const isEdited = (message as any).edited as boolean;

  if (msgType === "view_once") {
    return (
      <View style={[styles.wrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={[
            styles.bubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
            isHighlighted && styles.highlighted,
          ]}
        >
          {!isOwn && !isGrouped && (
            <ThemedText style={styles.senderName}>
              {message.sender?.name ?? "Unknown"}
            </ThemedText>
          )}
          <ViewOnceContent message={message} isOwn={isOwn} />
          <View style={styles.metaRow}>
            <ThemedText style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
              {formatBubbleTime(message.created_at)}
            </ThemedText>
            {isOwn && <ReadCheck status={readStatus} />}
          </View>
        </Pressable>
      </View>
    );
  }

  if (msgType === "voice" && voiceUrl) {
    return (
      <View style={[styles.wrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={400}
          style={[
            styles.bubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
            styles.voiceBubble,
          ]}
        >
          {!isOwn && !isGrouped && (
            <ThemedText style={styles.senderName}>
              {message.sender?.name ?? "Unknown"}
            </ThemedText>
          )}
          <VoicePlayer url={voiceUrl} isOwn={isOwn} duration={voiceDuration ?? 0} />
          <View style={styles.metaRow}>
            <ThemedText style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
              {formatBubbleTime(message.created_at)}
            </ThemedText>
            {isEdited && (
              <ThemedText style={[styles.edited, { color: isOwn ? "rgba(255,255,255,0.4)" : "#71717A" }]}>
                edited
              </ThemedText>
            )}
            {isOwn && <ReadCheck status={readStatus} />}
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isOwn ? styles.ownWrapper : styles.otherWrapper]}>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={[
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          isHighlighted && styles.highlighted,
          isGrouped && styles.groupedMessage,
          msgType === "image" && styles.imageBubble,
          msgType === "file" && styles.fileBubble,
        ]}
      >
        {replyTo && (
          <View style={styles.replyBlock}>
            <View style={[styles.replyBar, { backgroundColor: isOwn ? "rgba(255,255,255,0.4)" : "#6C47FF" }]} />
            <View style={styles.replyContent}>
              <ThemedText style={styles.replyName} numberOfLines={1}>
                {replyTo.sender?.name ?? "Unknown"}
              </ThemedText>
              <ThemedText style={[styles.replyText, isOwn && { color: "rgba(255,255,255,0.7)" }]} numberOfLines={1}>
                {replyTo.content}
              </ThemedText>
            </View>
          </View>
        )}

        {!isOwn && !isGrouped && (
          <ThemedText style={styles.senderName}>
            {message.sender?.name ?? "Unknown"}
          </ThemedText>
        )}

        {msgType === "image" && mediaUrl ? (
          <Pressable onPress={() => onViewImage?.(mediaUrl)}>
            <Image
              source={{ uri: mediaUrl }}
              style={styles.chatImage}
              contentFit="cover"
              transition={200}
            />
            {message.content && message.content !== "📷 Photo" && (
              <ThemedText style={[styles.content, isOwn ? styles.ownText : styles.otherText, { paddingHorizontal: 4, paddingTop: 4 }]}>
                {message.content}
              </ThemedText>
            )}
          </Pressable>
        ) : msgType === "file" ? (
          <View style={styles.fileContainer}>
            <View style={[styles.fileIcon, { backgroundColor: isOwn ? "rgba(255,255,255,0.15)" : "#2A2A2A" }]}>
              <Ionicons name="document-text-outline" size={24} color={isOwn ? "#FFFFFF" : "#6C47FF"} />
            </View>
            <View style={styles.fileInfo}>
              <ThemedText style={[styles.fileName, { color: isOwn ? "#FFFFFF" : "#E1E1E1" }]} numberOfLines={1}>
                {fileName || "File"}
              </ThemedText>
              {fileSize && (
                <ThemedText style={[styles.fileSize, { color: isOwn ? "rgba(255,255,255,0.5)" : "#71717A" }]}>
                  {formatFileSize(fileSize)}
                </ThemedText>
              )}
            </View>
          </View>
        ) : (
          <ThemedText style={[styles.content, isOwn ? styles.ownText : styles.otherText]}>
            {message.content}
          </ThemedText>
        )}

        <View style={styles.metaRow}>
          <ThemedText style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
            {formatBubbleTime(message.created_at)}
          </ThemedText>
          {isEdited && (
            <ThemedText style={[styles.edited, { color: isOwn ? "rgba(255,255,255,0.4)" : "#71717A" }]}>
              edited
            </ThemedText>
          )}
          {isOwn && <ReadCheck status={readStatus} />}
        </View>
      </Pressable>

      {reactionEntries.length > 0 && (
        <View style={[styles.reactionsRow, isOwn ? styles.ownReactionsRow : styles.otherReactionsRow]}>
          {reactionEntries.map(([emoji, { count, hasOwn }]) => (
            <Pressable
              key={emoji}
              onPress={() => onReaction?.(message.id, emoji)}
              style={[styles.reactionChip, hasOwn && styles.reactionChipActive]}
            >
              <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
              {count > 1 && <ThemedText style={styles.reactionCount}>{count}</ThemedText>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleInner);

const styles = StyleSheet.create({
  wrapper: { marginVertical: 0 },
  ownWrapper: { alignItems: "flex-end", paddingRight: 12, paddingLeft: 48, marginBottom: 2 },
  otherWrapper: { alignItems: "flex-start", paddingLeft: 12, paddingRight: 48, marginBottom: 2 },
  bubble: {
    maxWidth: "100%",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  ownBubble: { backgroundColor: "#6C47FF", borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: "#1C1C1E", borderBottomLeftRadius: 4 },
  groupedMessage: { marginTop: -2 },
  imageBubble: { padding: 4, overflow: "hidden", borderRadius: 16 },
  fileBubble: { padding: 4 },
  highlighted: { borderWidth: 2, borderColor: "#FFD700" },
  senderName: { fontSize: 12, fontWeight: "600", color: "#6C47FF", marginBottom: 2, paddingHorizontal: 8 },
  content: { fontSize: 15, lineHeight: 21 },
  ownText: { color: "#FFFFFF" },
  otherText: { color: "#E1E1E1" },
  metaRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
    gap: 3, marginTop: 1,
  },
  time: { fontSize: 10, lineHeight: 14 },
  ownTime: { color: "rgba(255,255,255,0.5)" },
  otherTime: { color: "#71717A" },
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
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8,
  },
  replyBar: { width: 3, borderRadius: 1.5 },
  replyContent: { flex: 1, gap: 1 },
  replyName: { fontSize: 11, fontWeight: "700", color: "#6C47FF" },
  replyText: { fontSize: 12, color: "#9E9E9E", lineHeight: 16 },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  ownReactionsRow: { paddingRight: 12, justifyContent: "flex-end" },
  otherReactionsRow: { paddingLeft: 12 },
  reactionChip: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "#1C1C1E", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: "transparent",
  },
  reactionChipActive: { borderColor: "#6C47FF", backgroundColor: "rgba(108,71,255,0.12)" },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: "#9E9E9E", fontWeight: "600" },
  voiceBubble: { minWidth: 200, paddingVertical: 10, paddingHorizontal: 12 },
  voiceContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceInfo: { flex: 1, gap: 4 },
  voiceBar: { height: 6, borderRadius: 3, overflow: "visible", position: "relative" },
  voiceProgress: { height: 6, borderRadius: 3, position: "absolute", left: 0, top: 0 },
  voiceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
    top: -3,
    marginLeft: -5,
  },
  voiceTime: { fontSize: 11, marginTop: 2 },
  edited: { fontSize: 10, fontStyle: "italic", marginLeft: 4 },
});
