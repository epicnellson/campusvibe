import { memo, useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
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

  const openLink = useCallback(() => {
    if (item.link) Linking.openURL(item.link);
  }, [item.link]);

  const sourceIcon =
    item.source === "unsplash"
      ? "image-outline"
      : item.source === "youtube"
        ? "logo-youtube"
        : "newspaper-outline";

  const sourceLabel =
    item.source === "unsplash"
      ? "Unsplash"
      : item.source === "youtube"
        ? "YouTube"
        : "News";

  const imageUrl = item.image_url || item.thumbnail_url;

  return (
    <Pressable style={styles.card} onPress={openLink} accessibilityRole="link">
      <View style={styles.header}>
        <View style={styles.sourceBadge}>
          <Ionicons name={sourceIcon as any} size={14} color="#AAA" />
          <Text style={styles.sourceText}>{sourceLabel}</Text>
        </View>
        <Text style={styles.time}>{formatTime(item.published_at)}</Text>
      </View>

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

      {item.author ? (
        <Text style={styles.author}>by {item.author}</Text>
      ) : null}

      {item.type === "video" ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={18} color="#FFF" />
        </View>
      ) : null}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceText: {
    fontSize: 12,
    color: "#AAA",
    fontWeight: "500",
  },
  time: {
    fontSize: 12,
    color: "#666",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E1E1E1",
    paddingHorizontal: 12,
    paddingTop: 8,
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
  author: {
    fontSize: 12,
    color: "#666",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  playBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
});
