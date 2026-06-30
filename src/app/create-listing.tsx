import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { createListing, updateListingPhotos } from "@/services/marketplace";
import { uploadListingPhoto } from "@/services/storage";
import { requireVerified } from "@/services/verification";

const CATEGORIES = ["Textbooks", "Electronics", "Clothing", "Other"];

export default function CreateListingScreen() {
  const { session, isLoading } = useSession();
  const { profile } = useProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const titleError =
    submitted && !title.trim()
      ? "Title cannot be empty"
      : undefined;

  const priceError = (() => {
    if (!submitted || !price.trim()) return undefined;
    const num = price.replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(num) || parseFloat(num) <= 0)
      return "Price must be a positive number";
    return undefined;
  })();

  const categoryError =
    submitted && !category
      ? "Please select a category"
      : undefined;

  if (isLoading) return null;
  if (!session) return <Redirect href="/" />;

  const handlePickImages = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library access is required");
        return;
      }

      const remaining = 4 - imageUris.length;
      if (remaining <= 0) {
        setError("Maximum 4 photos allowed");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
      });

      if (result.canceled) return;
      const newUris = result.assets.map((a: { uri: string }) => a.uri);
      setImageUris((prev) => [...prev, ...newUris].slice(0, 4));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pick images");
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setSubmitted(true);
    if (
      !title.trim() ||
      priceError ||
      !category
    ) {
      return;
    }

    if (!requireVerified(profile)) return;

    setSubmitting(true);
    setError(null);

    try {
      const listingId = await createListing({
        title: title.trim(),
        description: description.trim(),
        price: price.trim(),
        category,
      });

      if (imageUris.length > 0) {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < imageUris.length; i++) {
          const url = await uploadListingPhoto(listingId, i, imageUris[i]);
          uploadedUrls.push(url);
        }
        await updateListingPhotos(listingId, uploadedUrls);
      }

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create listing");
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
              <ThemedText style={styles.title}>Create Listing</ThemedText>
            </ThemedView>

            <ThemedView style={styles.form}>
              <Input
                placeholder="Title"
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
              />

              <Input
                placeholder="Price (e.g. 25 or $25)"
                value={price}
                onChangeText={(t: string) => { setPrice(t); setError(null); }}
                autoCapitalize="none"
                error={priceError}
              />

              <ThemedText themeColor="textSecondary" style={styles.categoryLabel}>
                Category
              </ThemedText>
              <ThemedView style={styles.categories}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => { setCategory(c); setError(null); }}
                    style={({ pressed }) => [
                      styles.categoryButton,
                      category === c && styles.categorySelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.categoryText,
                        category === c && styles.categoryTextSelected,
                      ]}
                    >
                      {c}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
              {categoryError && (
                <ThemedText style={styles.fieldError}>{categoryError}</ThemedText>
              )}

              <Pressable
                onPress={handlePickImages}
                style={({ pressed }) => [
                  styles.imagePicker,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText
                  themeColor={imageUris.length > 0 ? "text" : "textSecondary"}
                >
                  {imageUris.length > 0
                    ? `${imageUris.length}/4 photos selected`
                    : "Tap to add photos (up to 4)"}
                </ThemedText>
              </Pressable>

              {imageUris.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewStrip}>
                  {imageUris.map((uri, i) => (
                  <ThemedView key={i} style={styles.preview}>
                      <Pressable
                        onPress={() => removeImage(i)}
                        style={styles.removeButton}
                      >
                        <ThemedText style={styles.removeText}>✕</ThemedText>
                      </Pressable>
                      <Image
                        source={{ uri }}
                        style={styles.previewImage}
                        contentFit="cover"
                      />
                    </ThemedView>
                  ))}
                </ScrollView>
              )}

              {error && <ThemedText style={styles.error}>{error}</ThemedText>}

              <Button
                title={submitting ? "Creating..." : "Create Listing"}
                onPress={handleCreate}
                disabled={
                  submitting ||
                  !title.trim() ||
                  !description.trim() ||
                  !price.trim() ||
                  !category
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
  categoryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categorySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  categoryTextSelected: {
    color: "#ffffff",
    fontWeight: fontWeight.semibold,
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
  previewStrip: {
    flexDirection: "row",
  },
  preview: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    overflow: "hidden",
    position: "relative",
    marginRight: spacing.sm,
  },
  removeButton: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  removeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  fieldError: {
    color: colors.error,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
});
