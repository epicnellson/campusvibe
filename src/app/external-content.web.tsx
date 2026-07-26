import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/use-theme";

function ContentSkeleton({ colors }: { colors: ReturnType<typeof import("@/hooks/use-theme").useTheme> }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  const styles = StyleSheet.create({
    skeletonContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      zIndex: 2,
    },
    skeletonBlock: {
      width: "80%",
      height: 200,
      borderRadius: 12,
      backgroundColor: colors.skeleton,
    },
  });

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View style={[styles.skeletonBlock, { opacity }]} />
    </View>
  );
}

export default function ExternalContentScreen() {
  const colors = useTheme();
  const params = useLocalSearchParams<{
    url?: string;
    type?: string;
    title?: string;
    image_url?: string;
  }>();
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

  const iframeHtml = isYouTube && youtubeEmbedUrl
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}</style></head><body><iframe src="${youtubeEmbedUrl}" allow="autoplay;encrypted-media" allowfullscreen></iframe></body></html>`
    : "";

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 40,
      paddingHorizontal: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      color: colors.textOnDark,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
      marginHorizontal: 8,
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
    errorContainer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      zIndex: 3,
    },
    errorText: {
      color: colors.muted,
      fontSize: 16,
      marginTop: 12,
    },
    errorButton: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.skeleton,
    },
    errorButtonText: {
      color: colors.textOnDark,
      fontSize: 14,
      fontWeight: "600",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.closeButton} accessibilityLabel="Close">
          <Ionicons name="close" size={28} color={colors.textOnDark} />
        </Pressable>
        {title ? (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <View style={{ width: 44 }} />
      </View>

      {loading && <ContentSkeleton colors={colors} />}

      {isYouTube && youtubeEmbedUrl ? (
        <iframe
          srcDoc={iframeHtml}
          style={{ border: "none", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 } as any}
          allow="autoplay; encrypted-media"
          allowFullScreen
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
        />
      ) : imageUrl ? (
        <View style={styles.imageContainer}>
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
        <iframe
          src={url}
          style={{ border: "none", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 } as any}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
        />
      ) : null}

      {loadError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
          <Text style={styles.errorText}>Failed to load content</Text>
          <Pressable onPress={close} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
