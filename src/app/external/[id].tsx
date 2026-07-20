import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { ThemedText } from "@/components/themed-text";
import { ResponsiveImage } from "@/components/responsive-image";
import { YouTubeEmbed } from "@/components/youtube-embed";

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

const SOURCE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  news: "newspaper-outline",
  youtube: "logo-youtube",
  unsplash: "camera-outline",
};

export default function ExternalDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    description?: string;
    image_url?: string;
    link?: string;
    type?: string;
    source?: string;
    source_name?: string;
    published_at?: string;
    video_id?: string;
    author?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [imgError, setImgError] = useState(false);

  const title = params.title ?? "";
  const description = params.description ?? "";
  const imageUrl = params.image_url ?? "";
  const link = params.link ?? "";
  const type = params.type ?? "image";
  const source = params.source ?? "news";
  const sourceName = params.source_name ?? "";
  const publishedAt = params.published_at ?? "";
  const videoId = params.video_id ?? "";
  const author = params.author ?? "";

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: title,
        url: link || undefined,
      });
    } catch {}
  }, [title, link]);

  const iconName = SOURCE_ICONS[source] ?? "globe-outline";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          {sourceName || "Article"}
        </ThemedText>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          accessibilityLabel="Share"
        >
          <Ionicons name="share-outline" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sourceRow}>
          <View style={styles.sourceIcon}>
            <Ionicons name={iconName} size={18} color="#A1A1A6" />
          </View>
          <ThemedText style={styles.sourceText} numberOfLines={1}>
            {sourceName}
          </ThemedText>
          {author ? (
            <>
              <ThemedText style={styles.dot}>·</ThemedText>
              <ThemedText style={styles.authorText} numberOfLines={1}>
                {author}
              </ThemedText>
            </>
          ) : null}
          {publishedAt ? (
            <>
              <ThemedText style={styles.dot}>·</ThemedText>
              <ThemedText style={styles.timeText}>
                {relativeTime(publishedAt)}
              </ThemedText>
            </>
          ) : null}
        </View>

        <ThemedText style={styles.title}>{title}</ThemedText>

        {description ? (
          <ThemedText style={styles.description}>{description}</ThemedText>
        ) : null}

        {type === "video" && videoId ? (
          <View style={styles.mediaSection}>
            <YouTubeEmbed videoId={videoId} />
          </View>
        ) : imageUrl && !imgError ? (
          <View style={styles.mediaSection}>
            <ResponsiveImage source={imageUrl} borderRadius={0} />
          </View>
        ) : null}

        {link ? (
          <Pressable
            onPress={() => {
              if (Platform.OS === "web") {
                window.open(link, "_blank");
              }
            }}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          >
            <Ionicons name="open-outline" size={16} color="#6C47FF" />
            <ThemedText style={styles.linkText}>View original</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "#000000",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginHorizontal: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 6,
  },
  sourceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A1A1A6",
  },
  authorText: {
    fontSize: 14,
    color: "#71717A",
    flexShrink: 1,
  },
  dot: {
    fontSize: 14,
    color: "#3A3A3C",
  },
  timeText: {
    fontSize: 14,
    color: "#71717A",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 30,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#C7C7CC",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  mediaSection: {
    marginTop: 4,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(108, 71, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(108, 71, 255, 0.2)",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6C47FF",
  },
  pressed: {
    opacity: 0.7,
  },
});
