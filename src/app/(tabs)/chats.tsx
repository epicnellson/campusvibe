import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { ChannelCard } from "@/components/channel-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChatSkeleton } from "@/components/feed-skeleton";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import {
  fetchUserChannels,
  fetchChannelLastMessage,
  fetchUnreadCount,
  subscribeToChannelUpdates,
  subscribeToOnlineStatus,
  subscribeToTypingStatus,
  type ChannelUpdate,
} from "@/services/chats";
import { db_ops } from "@/services/db";
import { on as onEvent } from "@/utils/chat-events";
import type { Channel } from "@/services/database.types";

type ChannelWithMembers = Channel & { members: { user_id: string }[] };

type ChannelExtra = {
  lastMessage?: string;
  lastMessageTime?: string;
  messageType?: string;
  unreadCount: number;
  avatarUrl?: string;
  dmName?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  isTyping?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isCurrentUserLastSender?: boolean;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
    paddingBottom: BottomTabInset,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  listContent: {
    paddingBottom: 24,
    paddingTop: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default function ChatsScreen() {
  const colors = useTheme();
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const [channels, setChannels] = useState<ChannelWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, ChannelExtra>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const unsubRef = useRef<(() => void) | null>(null);
  const onlineUnsubs = useRef<Map<string, () => void>>(new Map());
  const typingUnsubs = useRef<Map<string, () => void>>(new Map());
  const hasFocusedOnce = useRef(false);
  const loadGenerationRef = useRef(0);

  const teardownSubscriptions = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    onlineUnsubs.current.forEach((u) => u());
    onlineUnsubs.current.clear();
    typingUnsubs.current.forEach((u) => u());
    typingUnsubs.current.clear();
  }, []);

  const getStorageKey = (prefix: string, channelId: string) => `${prefix}_${channelId}`;

  const readPinMuteArchive = async (channelId: string): Promise<{ isPinned: boolean; isMuted: boolean; isArchived: boolean }> => {
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const [pinned, muted, archived] = await Promise.all([
        AsyncStorage.getItem(getStorageKey("chat_pinned", channelId)),
        AsyncStorage.getItem(getStorageKey("chat_muted", channelId)),
        AsyncStorage.getItem(getStorageKey("chat_archived", channelId)),
      ]);
      return { isPinned: pinned === "true", isMuted: muted === "true", isArchived: archived === "true" };
    } catch {
      return { isPinned: false, isMuted: false, isArchived: false };
    }
  };

  const load = useCallback(async () => {
    if (!currentUserId) return;
    const gen = ++loadGenerationRef.current;

    // Tear down any previous subscriptions so overlapping loads never
    // leave duplicate listeners behind (audit #1).
    teardownSubscriptions();

    try {
      const data = await fetchUserChannels(currentUserId);
      if (gen !== loadGenerationRef.current) return;
      setChannels(data);

      const extraMap: Record<string, ChannelExtra> = {};
      const namePromises = data.map(async (ch) => {
        const extra: ChannelExtra = { unreadCount: 0 };
        const settings = await readPinMuteArchive(ch.id);
        extra.isPinned = settings.isPinned;
        extra.isMuted = settings.isMuted;
        extra.isArchived = settings.isArchived;
        if (ch.type === "dm") {
          const otherUserId = ch.members.find(
            (m) => m.user_id !== currentUserId
          )?.user_id;
          if (otherUserId) {
            const profile = await db_ops.get("profiles", otherUserId);
            extra.avatarUrl = profile?.avatar_url;
            extra.isVerified = profile?.verification_status === "approved";
            extra.dmName = profile?.name ?? "Unknown";
          }
        }
        try {
          const [lastMsg, unread] = await Promise.all([
            fetchChannelLastMessage(ch.id),
            fetchUnreadCount(ch.id, currentUserId),
          ]);
          if (lastMsg) {
            extra.lastMessage = lastMsg.content;
            extra.lastMessageTime = lastMsg.created_at;
            extra.messageType = lastMsg.type;
            extra.isCurrentUserLastSender = lastMsg.senderId === currentUserId;
          }
          extra.unreadCount = unread;
        } catch {}
        extraMap[ch.id] = extra;
      });

      await Promise.all(namePromises);
      if (gen !== loadGenerationRef.current) return;

      // Merge the fresh snapshot into existing extras instead of replacing
      // them wholesale, so realtime fields (online/typing/last message)
      // applied during the fetch window are preserved (audit #8).
      setExtras((prev) => {
        const merged: Record<string, ChannelExtra> = { ...prev };
        for (const id of Object.keys(extraMap)) {
          const fresh = extraMap[id];
          merged[id] = {
            ...(merged[id] ?? {}),
            ...fresh,
            unreadCount: Math.max(fresh.unreadCount ?? 0, merged[id]?.unreadCount ?? 0),
          };
        }
        // Drop extras for channels that no longer exist
        const liveIds = new Set(data.map((ch) => ch.id));
        for (const id of Object.keys(merged)) {
          if (!liveIds.has(id)) delete merged[id];
        }
        return merged;
      });

      // Subscribe to online presence for DM channels
      for (const ch of data) {
        if (ch.type === "dm") {
          const otherId = ch.members.find((m) => m.user_id !== currentUserId)?.user_id;
          if (otherId) {
            const unsub = subscribeToOnlineStatus(otherId, (online) => {
              setExtras((prev) => ({
                ...prev,
                [ch.id]: { ...prev[ch.id], isOnline: online, unreadCount: prev[ch.id]?.unreadCount ?? 0 },
              }));
            });
            onlineUnsubs.current.set(ch.id, unsub);
            const typingUnsub = subscribeToTypingStatus(ch.id, currentUserId, (typing) => {
              setExtras((prev) => ({
                ...prev,
                [ch.id]: { ...prev[ch.id], isTyping: typing, unreadCount: prev[ch.id]?.unreadCount ?? 0 },
              }));
            });
            typingUnsubs.current.set(ch.id, typingUnsub);
          }
        }
      }

      if (gen !== loadGenerationRef.current) return;
      unsubRef.current = subscribeToChannelUpdates(
        data.map((ch) => ch.id),
        (update: ChannelUpdate) => {
          setExtras((prev) => ({
            ...prev,
            [update.channelId]: {
              ...prev[update.channelId],
              lastMessage: update.lastMessage,
              lastMessageTime: update.lastMessageTime,
              messageType: update.type,
              isCurrentUserLastSender: update.userId === currentUserId,
              unreadCount: update.userId !== currentUserId
                ? (prev[update.channelId]?.unreadCount ?? 0) + 1
                : (prev[update.channelId]?.unreadCount ?? 0),
            },
          }));
        }
      );
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      if (gen === loadGenerationRef.current) setLoading(false);
    }
  }, [currentUserId, teardownSubscriptions]);

  useEffect(() => {
    load();
    const unsubRead = onEvent("channel_read", (channelId: string) => {
      setExtras((prev) => ({
        ...prev,
        [channelId]: { ...prev[channelId], unreadCount: 0 },
      }));
    });
    return () => {
      unsubRead();
      teardownSubscriptions();
    };
  }, [load, teardownSubscriptions]);

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) {
        load();
      } else {
        hasFocusedOnce.current = true;
      }
    }, [load])
  );

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const aExtra = extras[a.id] ?? { unreadCount: 0 };
      const bExtra = extras[b.id] ?? { unreadCount: 0 };
      if (aExtra.isPinned && !bExtra.isPinned) return -1;
      if (!aExtra.isPinned && bExtra.isPinned) return 1;
      const aUnread = aExtra.unreadCount ?? 0;
      const bUnread = bExtra.unreadCount ?? 0;
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;
      const aTime = aExtra.lastMessageTime ?? "";
      const bTime = bExtra.lastMessageTime ?? "";
      if (aTime && bTime) return bTime > aTime ? 1 : bTime < aTime ? -1 : 0;
      if (aTime) return -1;
      if (bTime) return 1;
      return 0;
    });
  }, [channels, extras]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return sortedChannels;
    const q = searchQuery.toLowerCase();
    return sortedChannels.filter((ch) => {
      const name = ch.type === "dm" ? (extras[ch.id]?.dmName ?? "") : ch.name;
      return name.toLowerCase().includes(q);
    });
  }, [sortedChannels, searchQuery, extras]);

  // Real conversations only: drop archived channels and any channel that has
  // never had a message exchange, then deduplicate so each target user or
  // conversation appears exactly once (picking the channel with the newest
  // activity when multiple exist for the same pair).
  const conversations = useMemo(() => {
    const byKey = new Map<string, ChannelWithMembers>();
    const dedupeKey = (ch: ChannelWithMembers): string => {
      if (ch.type === "dm") {
        const otherId = ch.members.find((m) => m.user_id !== currentUserId)?.user_id;
        return `dm:${otherId ?? ch.id}`;
      }
      return `channel:${ch.id}`;
    };
    for (const ch of filteredChannels) {
      const extra = extras[ch.id] ?? { unreadCount: 0 };
      if (extra.isArchived) continue;
      if (!extra.lastMessage) continue;
      const key = dedupeKey(ch);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, ch);
        continue;
      }
      const existingExtra = extras[existing.id] ?? { unreadCount: 0 };
      if ((extra.lastMessageTime ?? "") > (existingExtra.lastMessageTime ?? "")) {
        byKey.set(key, ch);
      }
    }
    return [...byKey.values()];
  }, [filteredChannels, extras, currentUserId]);

  const handleTogglePin = useCallback((chId: string) => async () => {
    const key = `chat_pinned_${chId}`;
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const next = !(extras[chId]?.isPinned ?? false);
      await AsyncStorage.setItem(key, next ? "true" : "false");
      setExtras((prev) => ({ ...prev, [chId]: { ...prev[chId], isPinned: next, unreadCount: prev[chId]?.unreadCount ?? 0 } }));
    } catch {}
  }, [extras]);
  const handleToggleMute = useCallback((chId: string) => async () => {
    const key = `chat_muted_${chId}`;
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const next = !(extras[chId]?.isMuted ?? false);
      await AsyncStorage.setItem(key, next ? "true" : "false");
      setExtras((prev) => ({ ...prev, [chId]: { ...prev[chId], isMuted: next, unreadCount: prev[chId]?.unreadCount ?? 0 } }));
    } catch {}
  }, [extras]);
  const handleToggleArchive = useCallback((chId: string) => async () => {
    const key = `chat_archived_${chId}`;
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const next = !(extras[chId]?.isArchived ?? false);
      await AsyncStorage.setItem(key, next ? "true" : "false");
      setExtras((prev) => ({ ...prev, [chId]: { ...prev[chId], isArchived: next, unreadCount: prev[chId]?.unreadCount ?? 0 } }));
    } catch {}
  }, [extras]);
  const handleDelete = useCallback((ch: ChannelWithMembers) => () => {
    Alert.alert("Delete Conversation", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleToggleArchive(ch.id) },
    ]);
  }, [handleToggleArchive]);
  const handleMarkRead = useCallback((ch: ChannelWithMembers) => async () => {
    if (!currentUserId) return;
    try {
      const { markChannelRead } = await import("@/services/chats");
      await markChannelRead(ch.id, currentUserId);
      setExtras((prev) => ({
        ...prev,
        [ch.id]: { ...prev[ch.id], unreadCount: 0 },
      }));
    } catch {}
  }, [currentUserId]);

  if (loading) {
    return <ChatSkeleton />;
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ThemedView style={styles.headerBar}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Messages</ThemedText>
          <View style={styles.searchRow}>
            <View style={[styles.searchField, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="search" size={17} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search..."
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  style={[styles.searchClear, { backgroundColor: colors.backgroundElement }]}
                >
                  <Ionicons name="close" size={12} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => router.push("/new-dm")}
              style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="New Conversation"
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </ThemedView>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item: ChannelWithMembers) => item.id}
            renderItem={({ item }) => {
              const extra = extras[item.id] ?? { unreadCount: 0 };
              return (
                <ChannelCard
                  channel={item}
                  displayName={item.type === "dm" ? extra.dmName : undefined}
                  avatarUrl={extra.avatarUrl}
                  isOnline={extra.isOnline}
                  isVerified={extra.isVerified}
                  isTyping={extra.isTyping ?? false}
                  isPinned={extra.isPinned}
                  isMuted={extra.isMuted}
                  isArchived={extra.isArchived}
                  isCurrentUserLastSender={extra.isCurrentUserLastSender}
                  lastMessage={extra.lastMessage}
                  messageType={extra.messageType}
                  lastMessageTime={extra.lastMessageTime}
                  unreadCount={extra.unreadCount}
                  onPress={() => router.push(`/chat/${item.id}`)}
                  onPin={handleTogglePin(item.id)}
                  onMute={handleToggleMute(item.id)}
                  onArchive={handleToggleArchive(item.id)}
                  onDelete={handleDelete(item)}
                  onMarkRead={handleMarkRead(item)}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.primary} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              <ThemedView style={styles.center}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.backgroundElement }]}>
                  <Ionicons
                    name={searchQuery ? "search-outline" : "chatbubbles-outline"}
                    size={36}
                    color={colors.textTertiary}
                  />
                </View>
                <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                  {searchQuery ? "No conversations found" : "No chats yet"}
                </ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : "Tap the compose button to start a conversation"}
                </ThemedText>
              </ThemedView>
            }
          />
        )}
      </View>
    </ThemedView>
  );
}
