import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Avatar } from "@/components/ui/Avatar";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useRefresh } from "@/hooks/use-refresh";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { createPost } from "@/services/posts";
import { createConfession } from "@/services/confessions";
import { uploadPostImage } from "@/services/storage";
import { requireVerified } from "@/services/verification";

const MAX_CHARS = 500;
const WARN_CHARS = 400;
const MAX_IMAGES = 4;

export default function ComposeScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isConfession = mode === "confession";
  const { session, isLoading } = useSession();
  const { profile } = useProfile();
  const { triggerFeedRefresh } = useRefresh();
  const theme = useTheme();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  if (isLoading) return null;
  if (!session) return <Redirect href="/" />;

  const contentError =
    submitted && !content.trim()
      ? "Please write something"
      : undefined;

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!requireVerified(profile)) return;

    setSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;
      if (images.length > 0) {
        const tempId = Date.now().toString();
        imageUrl = await uploadPostImage(tempId, images[0]);
      }
      if (isConfession) {
        await createConfession(trimmed, imageUrl);
      } else {
        await createPost(trimmed, imageUrl);
      }
      triggerFeedRefresh();
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const charCountColor =
    content.length >= MAX_CHARS
      ? colors.error
      : content.length >= WARN_CHARS
        ? colors.warning
        : theme.textSecondary;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.topBar}>
          <Pressable
            onPress={() => router.replace("/(tabs)")}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title}>{isConfession ? "New Confession" : "New Post"}</ThemedText>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !content.trim()}
            style={({ pressed }) => [
              styles.postButton,
              {
                backgroundColor: content.trim() && !submitting
                  ? colors.primary
                  : theme.backgroundElement,
              },
              pressed && styles.pressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <ThemedText
                style={[
                  styles.postButtonText,
                  {
                    color: content.trim()
                      ? "#FFF"
                      : theme.textSecondary,
                  },
                ]}
              >
                Post
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedView style={styles.userRow}>
              {isConfession ? (
                <ThemedView style={[styles.quickIcon, { backgroundColor: colors.warning }]}>
                  <Ionicons name="eye-off-outline" size={18} color="#FFF" />
                </ThemedView>
              ) : (
                <Avatar
                  uri={profile?.avatar_url}
                  name={profile?.name ?? "?"}
                  size={36}
                />
              )}
              <ThemedView style={styles.userInfo}>
                <ThemedText style={styles.userName}>
                  {isConfession ? "Anonymous" : (profile?.name ?? "Unknown")}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.visibility}>
                  {isConfession ? "Anonymous" : "Public"}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                },
              ]}
              placeholder="What's on your mind?"
              placeholderTextColor={theme.textSecondary}
              value={content}
              onChangeText={(t: string) => {
                if (t.length <= MAX_CHARS) setContent(t);
                setError(null);
              }}
              multiline
              autoFocus
              textAlignVertical="top"
            />

            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageList}
              >
                {images.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.imagePreview} />
                    <Pressable
                      style={styles.imageRemove}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {contentError && (
              <ThemedText style={styles.fieldError}>{contentError}</ThemedText>
            )}

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          </ScrollView>

          <ThemedView style={[styles.bottomBar, { borderTopColor: theme.border }]}>
            <ThemedText
              style={[styles.charCount, { color: charCountColor }]}
            >
              {content.length}/{MAX_CHARS}
            </ThemedText>
            <View style={styles.bottomActions}>
              <Pressable
                onPress={pickImages}
                style={({ pressed }) => [
                  styles.toolButton,
                  pressed && styles.pressed,
                ]}
                disabled={images.length >= MAX_IMAGES}
              >
                <Ionicons
                  name="image-outline"
                  size={22}
                  color={images.length >= MAX_IMAGES ? theme.textSecondary : colors.primary}
                />
              </Pressable>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  postButton: {
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  postButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  userInfo: {
    gap: 1,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  visibility: {
    fontSize: fontSize.xs,
  },
  input: {
    minHeight: 180,
    fontSize: 18,
    lineHeight: 26,
    paddingVertical: 0,
  },
  imageList: {
    gap: spacing.sm,
  },
  imageWrapper: {
    position: "relative",
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
  },
  imageRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldError: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  charCount: {
    fontSize: fontSize.sm,
  },
  bottomActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
