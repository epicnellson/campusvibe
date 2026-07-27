import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
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
  type ChannelUpdate,
} from "@/services/chats";
import { db_ops } from "@/services/db";
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
    color: "#FFFFFF",
    marginBottom: 10,
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
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6C47FF",
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
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#71717A",
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
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, ChannelExtra>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const unsubRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await fetchUserChannels(currentUserId);
      setChannels(data);

      const extraMap: Record<string, ChannelExtra> = {};
      const namePromises = data.map(async (ch) => {
        const extra: ChannelExtra = { unreadCount: 0 };
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
          }
          extra.unreadCount = unread;
        } catch {}
        extraMap[ch.id] = extra;
      });

      await Promise.all(namePromises);
      setExtras(extraMap);

      if (unsubRef.current) unsubRef.current();
      unsubRef.current = subscribeToChannelUpdates(
        data.map((ch) => ch.id),
        (update: ChannelUpdate) => {
          setExtras((prev) => ({
            ...prev,
            [update.channelId]: {
              ...prev[update.channelId],
              lastMessage: update.lastMessage,
              lastMessageTime: update.lastMessageTime,
              unreadCount: update.userId !== currentUserId
                ? (prev[update.channelId]?.unreadCount ?? 0) + 1
                : (prev[update.channelId]?.unreadCount ?? 0),
            },
          }));
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [load]);

  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const aTime = extras[a.id]?.lastMessageTime ?? "";
      const bTime = extras[b.id]?.lastMessageTime ?? "";
      if (aTime && bTime) return bTime > aTime ? 1 : -1;
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

  const publicChannels = filteredChannels.filter(
    (c) => c.type !== "dm" && !["general", "hostel", "department"].includes(c.type)
  );
  const dmChannels = filteredChannels.filter(
    (c) => c.type === "dm" && extras[c.id]?.lastMessage
  );

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ChatSkeleton />
      </ThemedView>
    );
  }

  const listData: any[] = [];
  if (dmChannels.length > 0) {
    listData.push({ section: true, title: "Direct Messages", key: "dm-section" });
    listData.push(...dmChannels);
  }
  if (publicChannels.length > 0) {
    listData.push({ section: true, title: "Channels", key: "ch-section" });
    listData.push(...publicChannels);
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ThemedView style={styles.headerBar}>
          <ThemedText style={styles.title}>Chats</ThemedText>
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Ionicons name="search" size={16} color="#71717A" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search conversations..."
                placeholderTextColor="#71717A"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  style={styles.searchClear}
                >
                  <Ionicons name="close" size={12} color="#A1A1A6" />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => router.push("/new-dm")}
              style={styles.newChatBtn}
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
            data={listData}
            keyExtractor={(item: any) =>
              "section" in item ? item.key : item.id
            }
            renderItem={({ item }: any) => {
              if ("section" in item) {
                return (
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionText}>
                      {item.title}
                    </ThemedText>
                  </View>
                );
              }
              const extra = extras[item.id] ?? { unreadCount: 0 };
              return (
                <ChannelCard
                  channel={item}
                  displayName={
                    item.type === "dm" ? extra.dmName : undefined
                  }
                  avatarUrl={extra.avatarUrl}
                  isOnline={extra.isOnline}
                  isVerified={extra.isVerified}
                  isTyping={false}
                  lastMessage={extra.lastMessage}
                  messageType={extra.messageType}
                  lastMessageTime={extra.lastMessageTime}
                  unreadCount={extra.unreadCount}
                  onPress={() => router.push(`/chat/${item.id}`)}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <ThemedView style={styles.center}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name={searchQuery ? "search-outline" : "chatbubbles-outline"}
                    size={36}
                    color="#3A3A3A"
                  />
                </View>
                <ThemedText style={styles.emptyTitle}>
                  {searchQuery
                    ? "No conversations found"
                    : "No chats yet"}
                </ThemedText>
                <ThemedText style={styles.emptySubtitle}>
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
