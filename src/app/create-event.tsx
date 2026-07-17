import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useRefresh } from "@/hooks/use-refresh";
import { useSession } from "@/hooks/use-session";
import { createEvent } from "@/services/events";
import { uploadEventImage } from "@/services/storage";
import { requireVerified } from "@/services/verification";

export default function CreateEventScreen() {
  const { session, isLoading } = useSession();
  const { profile } = useProfile();
  const { triggerFeedRefresh } = useRefresh();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const titleError =
    submitted && !title.trim()
      ? "Title cannot be empty"
      : undefined;

  const descError =
    submitted && !description.trim()
      ? "Description cannot be empty"
      : undefined;

  const dateError = (() => {
    if (!submitted || !date.trim()) return undefined;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date.trim())) return "Use YYYY-MM-DD format";
    const d = new Date(date.trim() + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d <= today) return "Date must be in the future";
    return undefined;
  })();

  const timeError =
    submitted && time.trim() && !/^\d{2}:\d{2}$/.test(time.trim())
      ? "Use HH:MM format"
      : undefined;

  const locationError =
    submitted && !location.trim()
      ? "Location cannot be empty"
      : undefined;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library access is required");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;
      setImageUri(result.assets[0].uri);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pick image");
    }
  };

  const handleCreate = async () => {
    setSubmitted(true);
    if (
      !title.trim() ||
      !description.trim() ||
      !date.trim() ||
      !time.trim() ||
      !location.trim() ||
      dateError ||
      timeError
    ) {
      return;
    }

    if (!requireVerified(profile)) return;

    setSubmitting(true);
    setError(null);

    try {
      const eventId = await createEvent({
        title: title.trim(),
        description: description.trim(),
        date: date.trim(),
        time: time.trim(),
        location: location.trim(),
      });

      if (imageUri) {
        const imageUrl = await uploadEventImage(eventId, imageUri);
        const { updateProfile } = await import("@/services/profile");
        const { supabase } = await import("@/services/supabase");
        await supabase
          .from("events")
          .update({ image_url: imageUrl })
          .eq("id", eventId);
      }

      triggerFeedRefresh();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedView style={styles.header}>
              <ThemedText style={styles.title}>Create Event</ThemedText>
            </ThemedView>

            <ThemedView style={styles.form}>
              <Input
                placeholder="Event title"
                value={title}
                onChangeText={(t: string) => { setTitle(t); setError(null); }}
                autoFocus
                error={titleError}
              />

              <Input
                placeholder="Description"
                value={description}
                onChangeText={(t: string) => { setDescription(t); setError(null); }}
                multiline
                style={styles.textArea}
                error={descError}
              />

              <Input
                placeholder="Date (YYYY-MM-DD)"
                value={date}
                onChangeText={(t: string) => { setDate(t); setError(null); }}
                autoCapitalize="none"
                error={dateError}
              />

              <Input
                placeholder="Time (HH:MM)"
                value={time}
                onChangeText={(t: string) => { setTime(t); setError(null); }}
                autoCapitalize="none"
                error={timeError}
              />

              <Input
                placeholder="Location"
                value={location}
                onChangeText={(t: string) => { setLocation(t); setError(null); }}
                error={locationError}
              />

              <Pressable
                onPress={handlePickImage}
                style={({ pressed }) => [
                  styles.imagePicker,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText
                  themeColor={imageUri ? "text" : "textSecondary"}
                >
                  {imageUri ? "Image selected ✓" : "Tap to add event image (optional)"}
                </ThemedText>
              </Pressable>

              {error && <ThemedText style={styles.error}>{error}</ThemedText>}

              <Button
                title={submitting ? "Creating..." : "Create Event"}
                onPress={handleCreate}
                disabled={
                  submitting ||
                  !title.trim() ||
                  !description.trim() ||
                  !date.trim() ||
                  !time.trim() ||
                  !location.trim()
                }
              />

              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => router.back()}
              />
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    maxWidth: 800,
    width: "100%",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  form: {
    gap: spacing.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  imagePicker: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: "dashed",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
});
