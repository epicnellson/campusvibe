import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMute } from "@/hooks/use-mute";
import { useTheme } from "@/hooks/use-theme";

export const YouTubeEmbed = memo(function YouTubeEmbed({
  videoId,
  aspectRatio = 16 / 9,
  isActive = true,
}: {
  videoId: string;
  aspectRatio?: number;
  isActive?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { isMuted, toggleMute } = useMute();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const colors = useTheme();

  useEffect(() => {
    if (isActive && !mounted) {
      const timer = setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(timer);
    }
  }, [isActive, mounted]);

  const postCommand = useCallback((func: string, args: any[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*"
      );
    } catch {}
  }, []);

  useEffect(() => {
    postCommand(isMuted ? "mute" : "unMute");
  }, [isMuted, postCommand]);

  const handleMutePress = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  const handlePausePress = useCallback(() => {
    postCommand(isPaused ? "playVideo" : "pauseVideo");
    setIsPaused((p) => !p);
  }, [isPaused, postCommand]);

  const styles = StyleSheet.create({
    container: {
      width: "100%",
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    controlRow: {
      position: "absolute",
      bottom: 8,
      right: 8,
      flexDirection: "row",
      gap: 6,
      zIndex: 10,
    },
    controlBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
    centerPlayPause: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
  });

  if (failed || !isActive || !mounted) {
    return (
      <View style={[styles.container, { aspectRatio }]}>
        <Image
          source={thumbUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        {!failed && isActive && (
          <View style={styles.centerPlayPause}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="play" size={24} color="#FFFFFF" />
            </View>
          </View>
        )}
        <View style={styles.controlRow}>
          <Pressable onPress={handleMutePress} style={styles.controlBtn} accessibilityLabel={isMuted ? "Unmute" : "Mute"}>
            <Ionicons name={isMuted ? "volume-mute-outline" : "volume-high-outline"} size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  const muteVal = isMuted ? 1 : 0;
  const iframeHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}</style></head><body><iframe id="player" src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muteVal}&playsinline=1&controls=0&rel=0&modestbranding=1&enablejsapi=1" allow="autoplay;encrypted-media" allowfullscreen></iframe><script>window.addEventListener("message",function(e){var f=document.getElementById("player");if(f&&f.contentWindow){f.contentWindow.postMessage(e.data,"*")}});</script></body></html>`;

  return (
    <View style={[styles.container, { aspectRatio }]}>
      <iframe
        ref={iframeRef}
        srcDoc={iframeHtml}
        style={{ border: "none", width: "100%", height: "100%", position: "absolute", top: 0, left: 0 } as any}
        allow="autoplay; encrypted-media"
        allowFullScreen
        onError={() => setFailed(true)}
      />
      <View style={styles.controlRow}>
        <Pressable onPress={handlePausePress} style={styles.controlBtn} accessibilityLabel={isPaused ? "Play" : "Pause"}>
          <Ionicons name={isPaused ? "play" : "pause"} size={16} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={handleMutePress} style={styles.controlBtn} accessibilityLabel={isMuted ? "Unmute" : "Mute"}>
          <Ionicons name={isMuted ? "volume-mute-outline" : "volume-high-outline"} size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
});
