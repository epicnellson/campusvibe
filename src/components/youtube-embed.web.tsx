import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

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

  const iframeHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}</style></head><body><iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1&enablejsapi=1" allow="autoplay;encrypted-media" allowfullscreen></iframe></body></html>`;

  return (
    <View style={[styles.container, { aspectRatio }]}>
      <iframe
        srcDoc={iframeHtml}
        style={{ border: "none", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 } as any}
        allow="autoplay; encrypted-media"
        allowFullScreen
        onError={() => setFailed(true)}
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
});
