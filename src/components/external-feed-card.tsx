import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ExternalFeedItem } from "@/services/feed-aggregator";

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export const ExternalFeedCard = memo(function ExternalFeedCard({
  item,
}: {
  item: ExternalFeedItem;
}) {
  const [imgError, setImgError] = useState(false);

  const openInApp = useCallback(() => {
    router.push({
      pathname: "/external-content",
      params: {
        url: item.link ?? "",
        type: item.type,
        title: item.title ?? "",
        image_url: item.image_url ?? item.thumbnail_url ?? "",
      },
    });
  }, [item.link, item.type, item.title, item.image_url, item.thumbnail_url]);

  const imageUrl = item.image_url || item.thumbnail_url;

  return (
    <Pressable style={styles.card} onPress={openInApp} accessibilityRole="button">
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {imageUrl && !imgError ? (
        <Image
          source={imageUrl}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={300}
          onError={() => setImgError(true)}
        />
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.time}>{formatTime(item.published_at)}</Text>
        {item.type === "video" ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={14} color="#FFF" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111111",
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E1E1E1",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  description: {
    fontSize: 13,
    color: "#888",
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    marginTop: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  time: {
    fontSize: 12,
    color: "#666",
  },
  playBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
