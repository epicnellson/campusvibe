import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";

export default function ExternalContentScreen() {
  const params = useLocalSearchParams<{
    url?: string;
    type?: string;
    title?: string;
    image_url?: string;
  }>();
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const url = params.url ?? "";
  const type = params.type ?? "image";
  const title = params.title ?? "";
  const imageUrl = params.image_url ?? "";

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  const isYouTube = type === "video" && (url.includes("youtube.com") || url.includes("youtu.be"));

  const youtubeEmbedUrl = (() => {
    if (!isYouTube) return "";
    let videoId = "";
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/);
    if (watchMatch) videoId = watchMatch[1];
    else if (shortMatch) videoId = shortMatch[1];
    else if (embedMatch) videoId = embedMatch[1];
    if (!videoId) return "";
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&controls=1&rel=0`;
  })();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.closeButton} accessibilityLabel="Close">
          <Ionicons name="close" size={28} color="#FFF" />
        </Pressable>
        {title ? (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <View style={{ width: 44 }} />
      </View>

      {isYouTube && youtubeEmbedUrl ? (
        <WebView
          source={{ uri: youtubeEmbedUrl }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
        />
      ) : imageUrl ? (
        <View style={styles.imageContainer}>
          {loading && (
            <ActivityIndicator size="large" color="#FFF" style={styles.loader} />
          )}
          <Image
            source={{ uri: imageUrl }}
            style={styles.fullImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
          />
        </View>
      ) : url ? (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
        />
      ) : null}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}

      {loadError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Failed to load content</Text>
          <Pressable onPress={close} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "#000",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  loader: {
    position: "absolute",
    zIndex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  errorText: {
    color: "#666",
    fontSize: 16,
    marginTop: 12,
  },
  errorButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#222",
  },
  errorButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
