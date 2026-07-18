import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchNotifications,
  markAllRead,
  actorMessage,
  type InAppNotification,
} from "@/services/in-app-notifications";
import { resolveImageUrl } from "@/services/storage";

const ICON_MAP: Record<string, string> = {
  like: "heart",
  repost: "repeat",
  follow: "person-add",
  comment: "chatbubble",
};

const COLOR_MAP: Record<string, string> = {
  like: "#EF4444",
  repost: "#22C55E",
  follow: "#6C47FF",
  comment: "#F59E0B",
};

const SCREEN_MAP: Record<string, string> = {
  post: "/post/",
  confession: "/confession/",
  event: "/event/",
  profile: "/",
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications(30);
      setItems(data);
    } catch (e) {
      console.warn("Failed to load notifications:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    markAllRead().catch(() => {});
  }, [load]);

  const handlePress = useCallback(
    (item: InAppNotification) => {
      if (item.content_type === "profile") {
        router.push("/");
      } else {
        const screen = SCREEN_MAP[item.content_type] ?? "/post/";
        router.push(`${screen}${item.content_id}` as any);
      }
    },
    []
  );

  const renderItem = ({ item }: { item: InAppNotification }) => {
    const icon = ICON_MAP[item.type] ?? "notifications";
    const color = COLOR_MAP[item.type] ?? "#71717A";
    const actorName =
      (item.actor as any)?.name ?? "Someone";
    const avatarUrl = (item.actor as any)?.avatar_url
      ? resolveImageUrl((item.actor as any).avatar_url, "profile-photos")
      : null;

    return (
      <Pressable
        onPress={() => handlePress(item)}
        style={({ pressed }) => [
          styles.row,
          !item.read && styles.unreadRow,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={16} color="#666" />
            </View>
          )}
          <View style={[styles.iconBadge, { backgroundColor: color }]}>
            <Ionicons name={icon as any} size={10} color="#FFF" />
          </View>
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.message} numberOfLines={2}>
            <Text style={styles.actorName}>{actorName}</Text>{" "}
            {actorMessage(item.type)}
          </Text>
          <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={48} color="#1E1E1E" />
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color="#1E1E1E" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptyHint}>You'll see when someone interacts with your posts</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  list: {
    paddingBottom: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  unreadRow: {
    backgroundColor: "rgba(108, 71, 255, 0.06)",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1A1A",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  message: {
    fontSize: 14,
    color: "#A0A0A0",
    lineHeight: 20,
  },
  actorName: {
    fontWeight: "700",
    color: "#E1E1E1",
  },
  time: {
    fontSize: 12,
    color: "#555",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6C47FF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#555",
  },
  emptyHint: {
    fontSize: 13,
    color: "#444",
    textAlign: "center",
    paddingHorizontal: 48,
  },
  pressed: {
    opacity: 0.65,
  },
});
