import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, "0");
  return `#${full}${a}`;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

type VoiceMessagePlayerProps = {
  url: string;
  isOwn: boolean;
  duration: number;
};

export const VoiceMessagePlayer = memo(function VoiceMessagePlayer({ url, isOwn, duration }: VoiceMessagePlayerProps) {
  const theme = useTheme();
  const player = useAudioPlayer(url, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [trackWidth, setTrackWidth] = useState(0);

  const pendingPlayRef = useRef(false);
  const pendingPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status.playing) {
      pendingPlayRef.current = false;
      if (pendingPlayTimerRef.current) {
        clearTimeout(pendingPlayTimerRef.current);
        pendingPlayTimerRef.current = null;
      }
    }
  }, [status.playing]);

  useEffect(() => {
    return () => {
      if (pendingPlayTimerRef.current) clearTimeout(pendingPlayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const togglePlay = useCallback(() => {
    if (pendingPlayRef.current) return;
    if (player.playing) {
      player.pause();
    } else {
      pendingPlayRef.current = true;
      pendingPlayTimerRef.current = setTimeout(() => {
        pendingPlayRef.current = false;
      }, 4000);
      player.play();
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
  }, [player]);

  const cycleSpeed = useCallback(() => {
    const next = playbackRate >= 2 ? 1 : playbackRate + 0.5;
    player.setPlaybackRate(next);
    setPlaybackRate(next);
  }, [player, playbackRate]);

  const handleSeek = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (trackWidth <= 0) return;
      const pct = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth));
      const totalMs = (status.duration || duration) * 1000;
      player.seekTo(Math.floor(pct * totalMs) / 1000);
    },
    [player, trackWidth, status.duration, duration]
  );

  const isLoaded = status.isLoaded;
  const isPlaying = status.playing;
  const positionSec = status.currentTime || 0;
  const totalSec = status.duration || duration || 0;
  const progress = totalSec > 0 ? Math.min(1, Math.max(0, positionSec / totalSec)) : 0;

  const accent = isOwn ? "#FFFFFF" : theme.primary;
  const track = isOwn ? withAlpha("#FFFFFF", 0.22) : withAlpha(theme.textSecondary, 0.22);
  const label = isOwn ? withAlpha("#FFFFFF", 0.75) : theme.textSecondary;

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.1) : withAlpha(theme.primary, 0.08) }]}>
        <View style={[styles.playBtn, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.2) : theme.primary }]}>
          <Ionicons name="hourglass-outline" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.info}>
          <View style={[styles.track, { backgroundColor: track }]} />
          <ThemedText style={[styles.time, { color: label }]}>Loading...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.1) : withAlpha(theme.primary, 0.08) }]}>
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [styles.playBtn, { backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.2) : theme.primary }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={20}
          color="#FFFFFF"
          style={!isPlaying ? { marginLeft: 2 } : undefined}
        />
      </Pressable>

      <View style={styles.info}>
        <Pressable
          onPress={handleSeek}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          hitSlop={8}
          style={[styles.track, { backgroundColor: track }]}
          accessibilityRole="adjustable"
          accessibilityLabel="Voice message progress"
        >
          <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        </Pressable>

        <View style={styles.meta}>
          <ThemedText style={[styles.time, { color: label }]}>
            {formatClock(positionSec)} / {formatClock(totalSec)}
          </ThemedText>
          <Pressable onPress={cycleSpeed} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Playback speed ${playbackRate}x`}>
            <ThemedText style={[styles.speed, { color: accent, backgroundColor: isOwn ? withAlpha("#FFFFFF", 0.14) : withAlpha(theme.primary, 0.14) }]}>
              {playbackRate}x
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const MONO_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  web: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  default: "monospace",
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    borderRadius: 16,
    minWidth: 240,
  },
  pressed: { opacity: 0.7 },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 6 },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  trackFill: { height: "100%", borderRadius: 3 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  time: { fontSize: 11, letterSpacing: 0.2, fontFamily: MONO_FONT },
  speed: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: "hidden",
    letterSpacing: 0.3,
  },
});
