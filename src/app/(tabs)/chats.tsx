import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { ChannelCard } from "@/components/channel-card";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { colors } from "@/theme";
import { useSession } from "@/hooks/use-session";
import { fetchUserChannels } from "@/services/chats";
import { supabase } from "@/services/supabase";
import type { Channel } from "@/services/database.types";

type ChannelWithMembers = Channel & { members: { user_id: string }[] };

export default function ChatsScreen() {
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const [channels, setChannels] = useState<ChannelWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dmNames, setDmNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await fetchUserChannels(currentUserId);
      setChannels(data);

      // Resolve DM channel display names
      const names: Record<string, string> = {};
      for (const ch of data) {
        if (ch.type === "dm") {
          const otherUserId = ch.members.find(
            (m) => m.user_id !== currentUserId
          )?.user_id;
          if (otherUserId) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", otherUserId)
              .single();
            names[ch.id] = profile?.name ?? "Unknown";
          }
        }
      }
      setDmNames(names);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const publicChannels = channels.filter((c) => c.type !== "dm");
  const dmChannels = channels.filter((c) => c.type === "dm");

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ThemedView style={styles.headerBar}>
          <ThemedText type="title" style={styles.title}>
            Chats
          </ThemedText>
          <Pressable
            onPress={() => router.push("/new-dm")}
            style={({ pressed }) => [
              styles.dmButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="New Conversation"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
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
          data={[
            ...(publicChannels.length > 0
              ? [{ section: true, title: "Channels" } as const, ...publicChannels]
              : []),
            ...(dmChannels.length > 0
              ? [{ section: true, title: "Direct Messages" } as const, ...dmChannels]
              : []),
          ]}
          keyExtractor={(item: any) =>
            "section" in item ? `section-${item.title}` : item.id
          }
          renderItem={({ item }: any) => {
            if ("section" in item) {
              return (
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                  {item.title}
                </ThemedText>
              );
            }
            return (
              <ChannelCard
                channel={item}
                displayName={dmNames[item.id]}
                onPress={() => router.push(`/chat/${item.id}`)}
              />
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <ThemedView style={styles.center}>
              <ThemedText themeColor="textSecondary">
                No chats yet. Start a new conversation!
              </ThemedText>
            </ThemedView>
          }
        />
        )}
      </View>
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
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
    paddingBottom: BottomTabInset,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingVertical: 2,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  dmButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
});
