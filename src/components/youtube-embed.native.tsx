import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Image } from "expo-image";

const WEBVIEW_HTML = (videoId: string) =>
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;justify-content:center;align-items:center;height:100vh}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}</style></head><body><iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1" allow="autoplay;encrypted-media" allowfullscreen></iframe></body></html>`;

export const YouTubeEmbed = memo(function YouTubeEmbed({
  videoId,
  aspectRatio = 16 / 9,
}: {
  videoId: string;
  aspectRatio?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    return (
      <View style={[styles.container, { aspectRatio }]}>
        <Image
          source={thumbUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { aspectRatio }]}>
      <WebView
        source={{ html: WEBVIEW_HTML(videoId) }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
});
