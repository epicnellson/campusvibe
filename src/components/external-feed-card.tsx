import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { ResponsiveImage } from "@/components/responsive-image";
import type { ExternalFeedItem } from "@/services/feed-aggregator";

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
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
  const isVideo = item.type === "video" && item.video_id;

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons
              name={isVideo ? "play" : "image-outline"}
              size={18}
              color="#71717A"
            />
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.headerRow}>
            <Text style={styles.sourceLabel} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.timestamp}>
              {relativeTime(item.published_at)}
            </Text>
          </View>

          {item.description ? (
            <Text style={styles.body} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          {isVideo ? (
            <YouTubeEmbed videoId={item.video_id!} />
          ) : imageUrl && !imgError ? (
            <Pressable onPress={openInApp} style={styles.imagePressable}>
              <ResponsiveImage source={imageUrl} borderRadius={14} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
    backgroundColor: "#000000",
  },
  contentRow: {
    flexDirection: "row",
  },
  leftColumn: {
    marginRight: 12,
    marginTop: 2,
    width: 40,
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 6,
  },
  sourceLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  dot: {
    fontSize: 14,
    color: "#3A3A3C",
  },
  timestamp: {
    fontSize: 13,
    color: "#71717A",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#A1A1A6",
    marginTop: 2,
  },
  imagePressable: {
    marginTop: 8,
  },
});
