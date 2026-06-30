import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/message-bubble";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { fetchMessages, sendMessage, subscribeToMessages } from "@/services/chats";
import { supabase } from "@/services/supabase";
import { requireVerified } from "@/services/verification";
import type { MessageWithSender } from "@/services/database.types";
import { router, useLocalSearchParams } from "expo-router";

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

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const channelId = id!;
  const { profile } = useProfile();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");
  const [initialCount, setInitialCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const ITEM_HEIGHT = 70;

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const [msgs, { data: ch }] = await Promise.all([
          fetchMessages(channelId),
          supabase.from("channels").select("name, type").eq("id", channelId).single(),
        ]);
        setMessages(msgs);
        setInitialCount(msgs.length);

        if (ch) {
          if (ch.type === "dm") {
            const { data: members } = await supabase
              .from("channel_members")
              .select("user_id")
              .eq("channel_id", channelId);
            const otherId = members?.find(
              (m: { user_id: string }) => m.user_id !== user?.id
            )?.user_id;
            if (otherId) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", otherId)
                .single();
              setChannelName(profile?.name ?? "DM");
            }
          } else {
            setChannelName(ch.name);
          }
        }
      } catch (e) {
        console.warn("Failed to load chat:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [channelId]);

  useEffect(() => {
    const unsub = subscribeToMessages(channelId, (msg) => {
      setMessages((prev) => {
        if (prev.length >= initialCount && initialCount > 0) {
          setHasUnread(true);
        }
        return [...prev, msg];
      });
    });
    return unsub;
  }, [channelId, initialCount]);

  useEffect(() => {
    const toggleTyping = () => {
      setOtherUserTyping(true);
      setTimeout(() => setOtherUserTyping(false), 3000);
    };
    const interval = setInterval(() => {
      if (Math.random() > 0.7) toggleTyping();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!otherUserTyping) {
      setDotCount(0);
      return;
    }
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, [otherUserTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    if (!requireVerified(profile)) {
      setInput(text);
      return;
    }

    setInput("");
    try {
      await sendMessage(channelId, text);
    } catch {
      setInput(text);
    }
  };

  const handleLongPress = (item: MessageWithSender) => {
    Alert.alert("Message Timestamp", messageTime(item.created_at));
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>{"<"}</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
            {channelName || "Chat"}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          renderItem={({ item, index }) => (
            <>
              <Pressable onLongPress={() => handleLongPress(item)}>
                <MessageBubble message={item} isOwn={item.user_id === currentUserId} />
              </Pressable>
              {hasUnread && index === initialCount - 1 && (
                <ThemedView style={styles.unreadDivider}>
                  <ThemedView style={styles.unreadLine} />
                  <ThemedText type="small" style={styles.unreadText}>
                    Unread
                  </ThemedText>
                  <ThemedView style={styles.unreadLine} />
                </ThemedView>
              )}
            </>
          )}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={
            otherUserTyping ? (
              <ThemedView style={styles.typingIndicator}>
                <ThemedText style={styles.typingText}>
                  {channelName} is typing{".".repeat(dotCount)}
                </ThemedText>
              </ThemedView>
            ) : null
          }
        />

        <ThemedView style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              !input.trim() && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
            disabled={!input.trim()}
          >
            <ThemedText style={styles.sendText}>Send</ThemedText>
          </Pressable>
        </ThemedView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundElement,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 20,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    flex: 1,
  },
  messageList: {
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.backgroundElement,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 40,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: "#ffffff",
    fontWeight: fontWeight.semibold,
    fontSize: 14,
  },
  unreadDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  unreadLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textSecondary,
  },
  unreadText: {
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.xs,
  },
  typingIndicator: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  typingText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontStyle: "italic",
  },
  pressed: {
    opacity: 0.7,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
