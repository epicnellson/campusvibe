import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spacing, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { updateProfile } from "@/services/profile";
import { uploadProfilePhoto } from "@/services/storage";

const DEPARTMENTS = [
  "Computer Science",
  "Engineering",
  "Mathematics",
  "Physics",
  "Biology",
  "Chemistry",
  "Business",
  "Arts",
  "Other",
];

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

const AVATAR_COLORS = [
  "#208AEF",
  "#E74C3C",
  "#2ECC71",
  "#F39C12",
  "#9B59B6",
  "#1ABC9C",
  "#E67E22",
  "#3498DB",
  "#E91E63",
  "#00BCD4",
];

function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function EditProfileScreen() {
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();
  const userId = session?.user?.id;

  const [name, setName] = useState(profile?.name ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [year, setYear] = useState(profile?.year ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<"name" | "department" | "year">("name");

  const nameError =
    submitted && step === "name" && !name.trim()
      ? "Name cannot be empty"
      : undefined;

  const deptError =
    submitted && step === "department" && !department
      ? "Please select a department"
      : undefined;

  const yearError =
    submitted && step === "year" && !year
      ? "Please select your year"
      : undefined;

  if (sessionLoading || profileLoading) return null;
  if (!session) return <Redirect href="/" />;

  const handlePickPhoto = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library access is required");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !userId) return;

      setUploading(true);
      setError(null);
      const url = await uploadProfilePhoto(userId, result.assets[0].uri);
      await updateProfile(userId, { avatar_url: url });
      setUploading(false);
    } catch (e) {
      setUploading(false);
      setError(e instanceof Error ? e.message : "Failed to upload photo");
    }
  };

  const handleNext = () => {
    setSubmitted(true);
    if (step === "name") {
      if (!name.trim()) return;
      setSubmitted(false);
      setError(null);
      setStep("department");
    } else if (step === "department") {
      if (!department) return;
      setSubmitted(false);
      setError(null);
      setStep("year");
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (!year || !userId) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile(userId, {
        name: name.trim(),
        department,
        year,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const avatarColor = pickColor(userId ?? "");
  const initial = (name || profile?.name)?.charAt(0)?.toUpperCase() ?? "?";
  const hasAvatarUrl = profile?.avatar_url;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <ThemedView style={styles.header}>
            <ThemedText style={styles.title}>Edit Profile</ThemedText>
          </ThemedView>

          <Pressable onPress={handlePickPhoto} disabled={uploading}>
            <ThemedView style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <ThemedText style={styles.avatarText}>{initial}</ThemedText>
            </ThemedView>
            <ThemedText
              themeColor="textSecondary"
              style={styles.photoHint}
            >
              {uploading ? "Uploading..." : "Tap to change photo"}
            </ThemedText>
          </Pressable>

          <ThemedView style={styles.form}>
            {step === "name" && (
              <Input
                placeholder="Your name"
                value={name}
                onChangeText={(t: string) => { setName(t); setError(null); }}
                autoCapitalize="words"
                autoFocus
                error={nameError}
              />
            )}

            {step === "department" && (
              <ThemedView style={styles.options}>
                {DEPARTMENTS.map((d) => (
                  <Button
                    key={d}
                    title={d}
                    variant={department === d ? "primary" : "secondary"}
                    onPress={() => { setDepartment(d); setError(null); }}
                  />
                ))}
                {deptError && (
                  <ThemedText style={styles.fieldError}>{deptError}</ThemedText>
                )}
              </ThemedView>
            )}

            {step === "year" && (
              <ThemedView style={styles.options}>
                {YEARS.map((y) => (
                  <Button
                    key={y}
                    title={y}
                    variant={year === y ? "primary" : "secondary"}
                    onPress={() => { setYear(y); setError(null); }}
                  />
                ))}
                {yearError && (
                  <ThemedText style={styles.fieldError}>{yearError}</ThemedText>
                )}
              </ThemedView>
            )}

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            {step !== "year" && (
              <Button
                title="Next"
                onPress={handleNext}
                disabled={
                  (step === "name" && !name.trim()) ||
                  (step === "department" && !department)
                }
              />
            )}
            {step === "year" && (
              <Button
                title={saving ? "Saving..." : "Save"}
                onPress={handleSave}
                disabled={saving || !year}
              />
            )}
          </ThemedView>

          {step !== "name" && (
            <Button
              title="Back"
              variant="secondary"
              onPress={() => {
                setError(null);
                setSubmitted(false);
                if (step === "department") setStep("name");
                else if (step === "year") setStep("department");
              }}
            />
          )}
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
    alignItems: "center",
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "700",
  },
  photoHint: {
    textAlign: "center",
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
  },
  form: {
    gap: spacing.sm,
  },
  options: {
    gap: spacing.sm,
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
