import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Animated, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useTheme } from "@/hooks/use-theme";

const QUICK_EMOJIS = [
  "😀", "😂", "❤️", "👍", "😮", "😢", "🔥", "🎉", "✨", "💯",
  "🤔", "😎", "🙏", "💪", "🤗", "😊", "😇", "🥳", "🫡", "💀",
];

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"];

type AttachKey = "document" | "gallery" | "camera";

const ATTACH_OPTIONS: {
  key: AttachKey;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
}[] = [
  { key: "document", icon: "document-text-outline", label: "Document / File", sub: "PDFs, notes, and other files" },
  { key: "gallery", icon: "images-outline", label: "Gallery / Media", sub: "Photos & videos" },
  { key: "camera", icon: "camera-outline", label: "Camera", sub: "Take a photo" },
];

type MediaPreview = {
  uri: string;
  type: "image" | "file";
  name?: string;
  contentType?: string;
  webFile?: File;
};

function RecordingWaveform() {
  const theme = useTheme();
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
          style={[waveformStyles.bar, { backgroundColor: theme.primary, height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 16] }) }]}
        />
      ))}
    </View>
  );
}

const waveformStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 3 },
  bar: { width: 3, borderRadius: 1.5 },
});

export type MessageInputProps = {
  onSend: (text: string) => void;
  onSendImage?: (uriOrBlob: string | Blob) => void;
  onSendFile?: (uri: string, name: string, contentType?: string) => void;
  onSendVoice?: (uriOrBlob: string | Blob, duration: number) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  replyPreview?: ReactNode;
  placeholder?: string;
};

function MessageInputInner({
  onSend,
  onSendImage,
  onSendFile,
  onSendVoice,
  onTyping,
  replyPreview,
  placeholder = "Type a message",
}: MessageInputProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(36);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasText = text.trim().length > 0;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const recordingStartTimeRef = useRef(0);

  // Web recording refs
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webAudioChunksRef = useRef<Blob[]>([]);

  // Web camera capture state
  const [showWebCamera, setShowWebCamera] = useState(false);
  const webCameraStreamRef = useRef<MediaStream | null>(null);
  const webVideoRef = useRef<HTMLVideoElement>(null);

  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);

  async function startRecording() {
    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        webRecorderRef.current = recorder;
        webStreamRef.current = stream;
        webAudioChunksRef.current = chunks;
        setIsRecording(true);
        setRecordingDuration(0);
        durationRef.current = 0;
        recordingStartTimeRef.current = Date.now();
        recordingTimerRef.current = setInterval(() => {
          durationRef.current = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
          setRecordingDuration(durationRef.current);
        }, 250);
      } catch (e: any) {
        const msg = e?.message ?? "";
        if (msg.includes("NotAllowed") || msg.includes("permission"))
          Alert.alert("Permission denied", "Microphone access is required for voice messages. Allow it in browser settings.");
        else if (msg.includes("NotFound"))
          Alert.alert("No microphone", "No microphone found on this device.");
        else
          Alert.alert("Error", "Could not start recording. Make sure you have a working microphone.");
      }
      return;
    }
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Microphone access is required for voice messages.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordingDuration(0);
      durationRef.current = 0;
      recordingStartTimeRef.current = Date.now();
      recordingTimerRef.current = setInterval(() => {
        durationRef.current = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(durationRef.current);
      }, 250);
    } catch (e) {
      console.warn("Failed to start recording:", e);
      Alert.alert("Error", "Could not start recording. Make sure you have a working microphone.");
    }
  }

  function sendVoiceNote(voice: { uriOrBlob: string | Blob; duration: number }) {
    return onSendVoice?.(voice.uriOrBlob, voice.duration);
  }

  function handleMicToggle() {
    if (hasText || isRecording) return;
    startRecording();
  }

  function stopRecording() {
    const finalDuration = durationRef.current;
    const finish = () => {
      setIsRecording(false);
      setRecordingDuration(0);
      durationRef.current = 0;
    };
    if (Platform.OS === "web") {
      const recorder = webRecorderRef.current;
      if (!recorder) return Promise.resolve();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      return new Promise<Blob>((resolve) => {
        const chunks = webAudioChunksRef.current;
        let allChunks: Blob[] = chunks.slice();
        const origHandler = recorder.ondataavailable;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) allChunks.push(e.data);
          origHandler?.call(recorder, e);
        };
        recorder.onstop = () => {
          resolve(new Blob(allChunks, { type: "audio/webm" }));
        };
        recorder.stop();
      })
        .then((blob) => {
          webStreamRef.current?.getTracks().forEach((t) => t.stop());
          if (finalDuration < 1) {
            Alert.alert("Too short", "Recording must be at least 1 second.");
            return;
          }
          webRecorderRef.current = null;
          webStreamRef.current = null;
          webAudioChunksRef.current = [];
          return sendVoiceNote({ uriOrBlob: blob, duration: finalDuration });
        })
        .catch(() => {
          Alert.alert("Error", "Could not process voice message.");
        })
        .finally(finish);
    }
    return (async () => {
      try {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        const uri = audioRecorder.uri;
        if (!uri) {
          Alert.alert("Error", "No recording data captured. Try again.");
          return;
        }
        if (finalDuration < 1) {
          Alert.alert("Too short", "Recording must be at least 1 second.");
          return;
        }
        await sendVoiceNote({ uriOrBlob: uri, duration: finalDuration });
      } catch (e) {
        console.warn("Failed to stop recording:", e);
        Alert.alert("Error", "Could not process voice message.");
      } finally {
        finish();
      }
    })();
  }

  async function cancelRecording() {
    if (Platform.OS === "web") {
      const recorder = webRecorderRef.current;
      if (!recorder) return;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      recorder.stop();
      webStreamRef.current?.getTracks().forEach((t) => t.stop());
      webRecorderRef.current = null;
      webStreamRef.current = null;
      webAudioChunksRef.current = [];
      setIsRecording(false);
      setRecordingDuration(0);
      durationRef.current = 0;
      return;
    }
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch {}
    setIsRecording(false);
    setRecordingDuration(0);
    durationRef.current = 0;
  }

  const handleTextChange = useCallback((val: string) => {
    setText(val);
    if (onTyping) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => onTyping(false), 2000);
    }
  }, [onTyping]);

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
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        webCameraStreamRef.current = stream;
        setShowWebCamera(true);
        setTimeout(() => {
          if (webVideoRef.current) {
            webVideoRef.current.srcObject = stream;
          }
        }, 100);
      } catch (e: any) {
        const msg = e?.message ?? "";
        if (msg.includes("NotAllowed") || msg.includes("permission"))
          Alert.alert("Permission denied", "Camera access is required to take photos. Allow it in browser settings.");
        else if (msg.includes("NotFound"))
          Alert.alert("No camera", "No camera found on this device.");
        else
          Alert.alert("Error", "Could not open camera.");
      }
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
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type?.startsWith("video/") ?? false;
      if (isVideo) {
        const name = asset.fileName ?? `video_${Date.now()}.mp4`;
        setMediaPreview({ uri: asset.uri, type: "file", name, contentType: asset.mimeType ?? "video/mp4" });
      } else {
        setMediaPreview({ uri: asset.uri, type: "image" });
      }
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
          setMediaPreview({ uri: file.uri, type: "file", name: file.name, contentType: file.mimeType });
        }
      }
    } catch {
      Alert.alert("Error", "Could not open file picker.");
    }
  }, []);

  const handlePlus = useCallback(() => {
    setShowAttach(true);
  }, []);

  const pickAttachment = useCallback(
    (action: AttachKey) => {
      setShowAttach(false);
      if (action === "document") handleAttach();
      else if (action === "gallery") handleGallery();
      else handleCamera();
    },
    [handleAttach, handleGallery, handleCamera]
  );

  const confirmSendMedia = useCallback(() => {
    if (!mediaPreview) return;
    if (mediaPreview.type === "image") {
      if (mediaPreview.webFile) {
        onSendImage?.(mediaPreview.webFile);
      } else {
        onSendImage?.(mediaPreview.uri);
      }
    } else {
      onSendFile?.(mediaPreview.uri, mediaPreview.name ?? "file", mediaPreview.contentType);
    }
    setMediaPreview(null);
  }, [mediaPreview, onSendImage, onSendFile]);

  const handleEmojiToggle = useCallback(() => {
    setShowEmoji((prev) => !prev);
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
  }, []);

  const captureWebPhoto = useCallback(() => {
    const video = webVideoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      webCameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      webCameraStreamRef.current = null;
      setShowWebCamera(false);
      setMediaPreview({ uri: URL.createObjectURL(file), type: "image", webFile: file });
    }, "image/jpeg", 0.85);
  }, []);

  const closeWebCamera = useCallback(() => {
    webCameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    webCameraStreamRef.current = null;
    setShowWebCamera(false);
  }, []);

  return (
    <View style={styles.wrapper}>
      {replyPreview}

      {showWebCamera && (
        <View style={styles.webCamOverlay}>
          <View style={styles.webCamHeader}>
            <Pressable onPress={closeWebCamera} style={styles.webCamClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.webCamTitle}>Take Photo</Text>
          </View>
          <video
            ref={webVideoRef}
            autoPlay
            playsInline
            style={styles.webCamVideo as any}
          />
          <View style={styles.webCamFooter}>
            <Pressable onPress={captureWebPhoto} style={styles.webCamCapture}>
              <Ionicons name="camera" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {mediaPreview && (
        <View style={styles.previewContainer}>
          {mediaPreview.type === "image" ? (
            <Image source={{ uri: mediaPreview.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewFile}>
              <Ionicons name="document-outline" size={32} color={theme.primary} />
              <Text style={styles.previewFileName} numberOfLines={1}>
                {mediaPreview.name}
              </Text>
            </View>
          )}
          <Pressable onPress={() => setMediaPreview(null)} style={styles.previewClose}>
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={confirmSendMedia} style={styles.previewSend}>
            <Ionicons name="arrow-up-circle" size={36} color={theme.primary} />
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
            <Text style={styles.recordingHint}>Recording voice message</Text>
          </View>
          <Pressable onPress={cancelRecording} style={styles.recordingCancel} accessibilityLabel="Cancel voice recording" accessibilityRole="button">
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
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
        <View style={styles.inputPill}>
          <Pressable onPress={handleEmojiToggle} style={styles.pillIcon} accessibilityLabel="Emoji" accessibilityRole="button">
            <Ionicons
              name={showEmoji ? "keypad-outline" : "happy-outline"}
              size={24}
              color={showEmoji ? theme.primary : theme.textSecondary}
            />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={[styles.input, { height: Math.max(36, Math.min(inputHeight, 96)) }]}
            value={text}
            onChangeText={handleTextChange}
            onBlur={() => { if (onTyping) { onTyping(false); if (typingTimerRef.current) clearTimeout(typingTimerRef.current); } }}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={1000}
            {...({ includeFontPadding: false } as object)}
            onContentSizeChange={(e) => {
              setInputHeight(e.nativeEvent.contentSize.height);
            }}
            blurOnSubmit={false}
          />

          <Pressable
            onPress={handlePlus}
            style={styles.pillIcon}
            accessibilityLabel="Attach file or photo"
            accessibilityRole="button"
          >
            <Ionicons name="attach" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          onPress={hasText ? handleSend : isRecording ? stopRecording : handleMicToggle}
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          accessibilityLabel={hasText ? "Send message" : isRecording ? "Send voice message" : "Record voice message"}
          accessibilityRole="button"
        >
          <Ionicons
            name={hasText || isRecording ? "paper-plane" : "mic"}
            size={hasText || isRecording ? 20 : 24}
            color="#FFFFFF"
            style={hasText || isRecording ? styles.sendIcon : undefined}
          />
        </Pressable>
      </View>

      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable
          style={[styles.attachOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => setShowAttach(false)}
          accessibilityRole="none"
        >
          <Pressable
            style={[styles.attachSheet, { backgroundColor: theme.backgroundElement }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.attachHeader}>
              <Ionicons name="attach" size={20} color={theme.primary} />
              <Text style={[styles.attachTitle, { color: theme.text }]}>Attach</Text>
            </View>
            {ATTACH_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => pickAttachment(option.key)}
                style={({ pressed }) => [
                  styles.attachOption,
                  { backgroundColor: theme.backgroundSecondary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.attachOptionIcon, { backgroundColor: theme.inputBgAlt }]}>
                  <Ionicons name={option.icon} size={22} color={theme.primary} />
                </View>
                <View style={styles.attachOptionText}>
                  <Text style={[styles.attachOptionLabel, { color: theme.text }]}>{option.label}</Text>
                  <Text style={[styles.attachOptionSub, { color: theme.textSecondary }]}>{option.sub}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowAttach(false)} style={styles.attachCancel} accessibilityRole="button">
              <Text style={[styles.attachCancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
      backgroundColor: theme.background,
    },
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 10,
      backgroundColor: theme.background,
    },
    inputPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 24,
      borderWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minHeight: 44,
      maxHeight: 120,
      backgroundColor: theme.inputBg,
    },
    pillIcon: {
      padding: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      fontSize: 15,
      lineHeight: 20,
      color: theme.text,
      paddingHorizontal: 8,
      paddingTop: 4,
      paddingBottom: 2,
      textAlignVertical: "center",
      maxHeight: 96,
      borderWidth: 0,
      outlineWidth: 0,
    },
    actionBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    sendIcon: {
      marginLeft: 2,
      marginTop: 1,
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
      backgroundColor: theme.primary + "1A",
    },
    recordingText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "500",
    },
    recordingInfo: {
      flex: 1,
      gap: 2,
    },
    recordingHint: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: "400",
    },
    recordingCancel: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.inputBgAlt,
    },
    previewContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 10,
      backgroundColor: theme.backgroundSecondary,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
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
      backgroundColor: theme.backgroundElement,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    previewFileName: {
      fontSize: 9,
      color: theme.textSecondary,
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
    attachOverlay: {
      flex: 1,
      justifyContent: "flex-end",
    },
    attachSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 16,
      gap: 8,
    },
    attachHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
    },
    attachTitle: {
      fontSize: 17,
      fontWeight: "600",
    },
    attachOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      minHeight: 48,
    },
    attachOptionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    attachOptionText: {
      flex: 1,
      gap: 1,
    },
    attachOptionLabel: {
      fontSize: 15,
      fontWeight: "500",
    },
    attachOptionSub: {
      fontSize: 12,
    },
    attachCancel: {
      alignItems: "center",
      paddingVertical: 14,
      minHeight: 48,
      justifyContent: "center",
    },
    attachCancelText: {
      fontSize: 15,
    },
    pressed: {
      opacity: 0.7,
    },
    webCamOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 500,
      backgroundColor: "#000000",
      zIndex: 100,
      overflow: "hidden",
    },
    webCamHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 12,
    },
    webCamClose: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.15)",
    },
    webCamTitle: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    webCamVideo: {
      flex: 1,
      width: "100%",
      backgroundColor: "#000000",
    },
    webCamFooter: {
      alignItems: "center",
      paddingVertical: 20,
    },
    webCamCapture: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 4,
      borderColor: "rgba(255,255,255,0.3)",
    },
  });
}

export const MessageInput = memo(MessageInputInner);
