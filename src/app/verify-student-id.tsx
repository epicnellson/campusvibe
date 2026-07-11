import { useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { uploadStudentId } from "@/services/storage";

export default function VerifyStudentIdScreen() {
  const { session, isLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFileSize, setImageFileSize] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, []);

  if (isLoading || profileLoading) return null;
  if (!session) return <Redirect href="/" />;
  if (!profile) return <Redirect href="/onboarding" />;
  if (profile.verification_status === "approved") return <Redirect href="/(tabs)" />;

  const simulateProgress = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();
  };

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        const libPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPermission.granted) {
          setError("Camera or photo library access is required");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      setImageUri(result.assets[0].uri);
      setImageFileSize(result.assets[0].fileSize);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pick image");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera access is required to take a photo");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      setImageUri(result.assets[0].uri);
      setImageFileSize(result.assets[0].fileSize);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to take photo");
    }
  };

  const handleUpload = async () => {
    if (!imageUri) {
      setError("Please select an image of your student ID");
      return;
    }
    setUploading(true);
    setError(null);
    simulateProgress();
    try {
      const result = await uploadStudentId(session.user.id, imageUri, imageFileSize);
      if (!result.success) {
        setError(result.error ?? "Upload failed");
        setUploading(false);
        return;
      }
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
      setTimeout(() => setUploaded(true), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  if (uploaded) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <ThemedView style={styles.centerContent}>
              <ThemedText style={styles.successIcon}>✓</ThemedText>
              <ThemedText style={styles.title}>ID uploaded!</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                Your student ID is now being reviewed. This usually takes
                24-48 hours. You can browse the app in the meantime.
              </ThemedText>
            </ThemedView>
            <Button title="Start browsing" onPress={() => router.replace("/(tabs)")} size="lg" />
          </Animated.View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.content}
          >
            <ThemedView style={styles.centerContent}>
              <ThemedText style={styles.title}>Verify your student ID</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                To keep CampusVibe safe and authentic, we need to verify
                you are a real student. Upload a photo of your student ID
                card. It will not be shared publicly.
              </ThemedText>

              {imageUri ? (
                <ThemedView style={styles.previewCard}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  <Pressable onPress={() => setImageUri(null)} style={styles.removeButton}>
                    <ThemedText style={styles.removeText} themeColor="textSecondary">
                      Remove and choose again
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              ) : (
                <ThemedView style={styles.uploadBox}>
                  <Pressable onPress={handlePickImage} style={styles.uploadArea}>
                    <ThemedText style={styles.cameraIcon}>📷</ThemedText>
                    <ThemedText style={styles.uploadLabel}>
                      Tap to choose from gallery
                    </ThemedText>
                    <ThemedText themeColor="textTertiary" style={styles.uploadHint}>
                      or take a photo
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={handleTakePhoto} style={styles.photoButton}>
                    <ThemedText style={styles.photoButtonText}>Take a photo</ThemedText>
                  </Pressable>
                </ThemedView>
              )}
            </ThemedView>

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            {uploading && (
              <ThemedView style={styles.progressContainer}>
                <ThemedView style={styles.progressTrack}>
                  <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
                </ThemedView>
                <ThemedText style={styles.progressText} themeColor="textSecondary">
                  Uploading...
                </ThemedText>
              </ThemedView>
            )}

            <Button
              title={uploading ? "Uploading..." : imageUri ? "Upload ID" : "Select your student ID"}
              onPress={handleUpload}
              disabled={uploading || !imageUri}
              size="lg"
            />

            {error && imageUri && !uploading && (
              <Button title="Retry upload" onPress={handleUpload} variant="secondary" size="lg" />
            )}

            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.7 }]}
            >
              <ThemedText themeColor="textSecondary" style={styles.skipText}>
                I'll do this later
              </ThemedText>
            </Pressable>
          </KeyboardAvoidingView>
        </Animated.View>
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
  wrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "flex-start",
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  centerContent: {
    gap: spacing.md,
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 34,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  successIcon: {
    fontSize: 48,
    textAlign: "center",
    color: colors.success,
  },
  uploadBox: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  uploadArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl * 2 + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: "dashed",
    gap: spacing.sm,
    overflow: "visible",
  },
  cameraIcon: {
    fontSize: 40,
    lineHeight: 48,
  },
  uploadLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  uploadHint: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  photoButton: {
    width: "100%",
    alignItems: "center",
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 48,
  },
  photoButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
  previewCard: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundElement,
    width: "100%",
  },
  previewImage: {
    width: 280,
    height: 180,
    borderRadius: borderRadius.md,
  },
  removeButton: {
    paddingVertical: spacing.xs,
  },
  removeText: {
    fontSize: fontSize.sm,
    textDecorationLine: "underline",
  },
  progressContainer: {
    gap: spacing.xs,
    alignItems: "center",
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: fontSize.xs,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.md,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
