import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";

const QUICK_EMOJIS = [
  "😀", "😂", "❤️", "👍", "😮", "😢", "🔥", "🎉", "✨", "💯",
  "🤔", "😎", "🙏", "💪", "🤗", "😊", "😇", "🥳", "🫡", "💀",
];

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"];

type MediaPreview = {
  uri: string;
  type: "image" | "file";
  name?: string;
};

function RecordingWaveform() {
  const bars = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.6)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.8)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1, duration: 300 + i * 50, useNativeDriver: Platform.OS !== "web" }),
          Animated.timing(bar, { toValue: 0.2, duration: 300 + i * 50, useNativeDriver: Platform.OS !== "web" }),
        ])
      )
    );
    const composite = Animated.parallel(animations);
    composite.start();
    return () => composite.stop();
  }, []);

  return (
    <View style={waveformStyles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[waveformStyles.bar, { height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 16] }) }]}
        />
      ))}
    </View>
  );
}

const waveformStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 3 },
  bar: { width: 3, borderRadius: 1.5, backgroundColor: "#FF3B30" },
});

export type MessageInputProps = {
  onSend: (text: string) => void;
  onSendImage?: (uri: string) => void;
  onSendFile?: (uri: string, name: string) => void;
  onSendVoice?: (uri: string, duration: number) => void;
  replyPreview?: React.ReactNode;
  placeholder?: string;
};

function MessageInputInner({
  onSend,
  onSendImage,
  onSendFile,
  onSendVoice,
  replyPreview,
  placeholder = "Message...",
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(36);
  const hasText = text.trim().length > 0;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    setInputHeight(36);
    setShowEmoji(false);
  }, [text, onSend]);

  const handleCamera = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Camera on web", "Use the Gallery option to select a photo.");
      handleGallery();
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaPreview({ uri: result.assets[0].uri, type: "image" });
    }
  }, []);

  const handleGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaPreview({ uri: result.assets[0].uri, type: "image" });
    }
  }, []);

  const handleAttach = useCallback(async () => {
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const isImage = IMAGE_EXTENSIONS.includes(ext) || file.mimeType?.startsWith("image/");
        if (isImage) {
          setMediaPreview({ uri: file.uri, type: "image", name: file.name });
        } else {
          setMediaPreview({ uri: file.uri, type: "file", name: file.name });
        }
      }
    } catch {
      Alert.alert("Error", "Could not open file picker.");
    }
  }, []);

  const confirmSendMedia = useCallback(() => {
    if (!mediaPreview) return;
    if (mediaPreview.type === "image") {
      onSendImage?.(mediaPreview.uri);
    } else {
      onSendFile?.(mediaPreview.uri, mediaPreview.name ?? "file");
    }
    setMediaPreview(null);
  }, [mediaPreview, onSendImage, onSendFile]);

  const handleCameraPress = useCallback(() => {
    Alert.alert("Send Photo", "Choose a source", [
      { text: "Camera", onPress: handleCamera },
      { text: "Gallery", onPress: handleGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleCamera, handleGallery]);

  const handleEmojiToggle = useCallback(() => {
    setShowEmoji((prev) => !prev);
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
  }, []);

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Voice recording is not available on web. Please use the mobile app.");
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Microphone access is required for voice messages.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      durationRef.current = 0;
      recordingTimerRef.current = setInterval(() => {
        durationRef.current += 1;
        setRecordingDuration(durationRef.current);
      }, 1000);
    } catch (e) {
      console.warn("Failed to start recording:", e);
      Alert.alert("Error", "Could not start recording. Make sure you have a working microphone.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current || !onSendVoice) {
      Alert.alert("Error", "Voice recording is not initialized.");
      return;
    }
    const finalDuration = durationRef.current;
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      durationRef.current = 0;
      if (!uri) {
        Alert.alert("Error", "No recording data captured. Try again.");
        return;
      }
      if (finalDuration < 1) {
        Alert.alert("Too short", "Recording must be at least 1 second.");
        return;
      }
      onSendVoice(uri, finalDuration);
    } catch (e) {
      console.warn("Failed to stop recording:", e);
      Alert.alert("Error", "Could not process voice message.");
      setIsRecording(false);
      setRecordingDuration(0);
      durationRef.current = 0;
    }
  }, [onSendVoice]);

  const cancelRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
    durationRef.current = 0;
  }, []);

  return (
    <View style={styles.wrapper}>
      {replyPreview}

      {mediaPreview && (
        <View style={styles.previewContainer}>
          {mediaPreview.type === "image" ? (
            <Image source={{ uri: mediaPreview.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewFile}>
              <Ionicons name="document-outline" size={32} color="#6C47FF" />
              <Text style={styles.previewFileName} numberOfLines={1}>
                {mediaPreview.name}
              </Text>
            </View>
          )}
          <Pressable onPress={() => setMediaPreview(null)} style={styles.previewClose}>
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={confirmSendMedia} style={styles.previewSend}>
            <Ionicons name="arrow-up-circle" size={36} color="#6C47FF" />
          </Pressable>
        </View>
      )}

      {isRecording && (
        <View style={styles.recordingBar}>
          <RecordingWaveform />
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingText}>
              {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
            </Text>
            <Text style={styles.recordingHint}>Tap stop to send, X to cancel</Text>
          </View>
        </View>
      )}

      {showEmoji && (
        <View style={styles.emojiGrid}>
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => insertEmoji(emoji)}
              style={styles.emojiBtn}
            >
              <Text style={styles.emojiChar}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.container}>
        <Pressable
          onPress={isRecording ? cancelRecording : handleCameraPress}
          style={styles.iconBtn}
        >
          <Ionicons
            name={isRecording ? "close-circle" : "camera-outline"}
            size={24}
            color={isRecording ? "#FF3B30" : "#71717A"}
          />
        </Pressable>

        <Pressable onPress={handleAttach} style={styles.iconBtn}>
          <Ionicons name="add-circle-outline" size={24} color="#71717A" />
        </Pressable>

        <TextInput
          ref={inputRef}
          style={[styles.input, { height: Math.max(36, Math.min(inputHeight, 120)) }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#71717A"
          multiline
          maxLength={1000}
          onContentSizeChange={(e) => {
            setInputHeight(e.nativeEvent.contentSize.height);
          }}
          blurOnSubmit={false}
        />

        <Pressable onPress={handleEmojiToggle} style={styles.iconBtn}>
          <Ionicons
            name={showEmoji ? "keypad-outline" : "happy-outline"}
            size={24}
            color={showEmoji ? "#6C47FF" : "#71717A"}
          />
        </Pressable>

        {isRecording ? (
          <Pressable onPress={stopRecording} style={styles.stopBtn}>
            <Ionicons name="stop" size={17} color="#FFFFFF" />
          </Pressable>
        ) : hasText ? (
          <Pressable onPress={handleSend} style={styles.sendBtn}>
            <Ionicons name="send" size={17} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable onPress={startRecording} style={styles.iconBtn}>
            <Ionicons name="mic" size={22} color="#71717A" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const MessageInput = memo(MessageInputInner);

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1E1E1E",
    backgroundColor: "#000000",
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 6,
    paddingVertical: 8,
    gap: 0,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 9 : 8,
    paddingBottom: Platform.OS === "ios" ? 9 : 8,
    fontSize: 15,
    lineHeight: 20,
    color: "#FFFFFF",
    maxHeight: 120,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 2,
  },
  emojiBtn: {
    width: "10%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChar: {
    fontSize: 24,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,59,48,0.1)",
  },
  recordingText: {
    fontSize: 13,
    color: "#FF3B30",
    fontWeight: "500",
  },
  recordingInfo: {
    flex: 1,
    gap: 2,
  },
  recordingHint: {
    fontSize: 11,
    color: "#FF9500",
    fontWeight: "400",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: "#0A0A0A",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1E1E1E",
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  previewFile: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  previewFileName: {
    fontSize: 9,
    color: "#9E9E9E",
    width: 52,
    textAlign: "center",
  },
  previewClose: {
    position: "absolute",
    top: 2,
    left: 52,
  },
  previewSend: {
    marginLeft: "auto",
  },
});
