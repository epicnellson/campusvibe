import { Redirect, router } from "expo-router";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
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
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { colors, spacing } from "@/theme";
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
  "#208AEF", "#E74C3C", "#2ECC71", "#F39C12",
  "#9B59B6", "#1ABC9C", "#E67E22", "#3498DB",
  "#E91E63", "#00BCD4",
];

function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type Step = "name" | "department" | "year";

export default function EditProfileScreen() {
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading, refreshProfile } = useProfile();
  const userId = session?.user?.id;

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("name");

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setDepartment(profile.department ?? "");
      setYear(profile.year ?? "");
    }
  }, [profile]);

  if (sessionLoading || profileLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;

  const avatarColor = pickColor(userId ?? "");
  const initial = (name || profile?.name)?.charAt(0)?.toUpperCase() ?? "?";

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
      await refreshProfile();
      setUploading(false);
    } catch (e) {
      setUploading(false);
      setError(e instanceof Error ? e.message : "Failed to upload photo");
    }
  };

  const handleNext = () => {
    if (step === "name") {
      if (!name.trim()) { setError("Name cannot be empty"); return; }
      setError(null);
      setStep("department");
    } else if (step === "department") {
      if (!department) { setError("Please select a department"); return; }
      setError(null);
      setStep("year");
    }
  };

  const handleSave = async () => {
    if (!year || !userId) { setError("Please select your year"); return; }
    setSaving(true);
    setError(null);
    try {
      await updateProfile(userId, { name: name.trim(), department, year });
      await refreshProfile();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const STEP_IDX: Record<Step, number> = { name: 0, department: 1, year: 2 };
  const progress = (STEP_IDX[step] + 1) / 3;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === "name") router.back();
              else if (step === "department") setStep("name");
              else setStep("department");
              setError(null);
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Edit Profile</ThemedText>
          {step === "year" ? (
            <Pressable
              onPress={handleSave}
              disabled={saving || !year}
              style={({ pressed }) => [styles.saveBtn, (!year || saving) && styles.saveBtnDisabled, pressed && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <ThemedText style={styles.saveBtnText}>Save</ThemedText>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            >
              <ThemedText style={styles.saveBtnText}>Next</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar */}
            <Pressable
              onPress={handlePickPhoto}
              disabled={uploading}
              style={({ pressed }) => [styles.avatarContainer, pressed && styles.pressed]}
            >
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <ThemedText style={styles.avatarText}>{initial}</ThemedText>
              </View>
              <View style={styles.avatarEditBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="camera" size={14} color="#FFF" />
                )}
              </View>
            </Pressable>
            <ThemedText style={styles.photoHint}>
              {uploading ? "Uploading…" : "Tap to change photo"}
            </ThemedText>

            {/* Step label */}
            <ThemedText style={styles.stepLabel}>
              {step === "name" && "What's your name?"}
              {step === "department" && "Your department"}
              {step === "year" && "Your year"}
            </ThemedText>

            {/* Name input */}
            {step === "name" && (
              <TextInput
                style={styles.textInput}
                placeholder="Full name"
                placeholderTextColor="#4A4A4A"
                value={name}
                onChangeText={(t) => { setName(t); setError(null); }}
                autoCapitalize="words"
                autoFocus
                selectionColor={colors.primary}
              />
            )}

            {/* Department chips */}
            {step === "department" && (
              <View style={styles.chipGrid}>
                {DEPARTMENTS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => { setDepartment(d); setError(null); }}
                    style={({ pressed }) => [
                      styles.chip,
                      department === d && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={[styles.chipText, department === d && styles.chipTextActive]}>
                      {d}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Year chips */}
            {step === "year" && (
              <View style={styles.chipGrid}>
                {YEARS.map((y) => (
                  <Pressable
                    key={y}
                    onPress={() => { setYear(y); setError(null); }}
                    style={({ pressed }) => [
                      styles.chip,
                      year === y && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={[styles.chipText, year === y && styles.chipTextActive]}>
                      {y}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}

            {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  saveBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    backgroundColor: "#1A1A1A",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  progressTrack: {
    height: 2,
    backgroundColor: "#111111",
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 60,
    alignItems: "center",
    gap: spacing.md,
  },
  avatarContainer: {
    position: "relative",
    width: 90,
    height: 90,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "700",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  photoHint: {
    fontSize: 13,
    color: "#71717A",
  },
  stepLabel: {
    alignSelf: "flex-start",
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: spacing.sm,
  },
  textInput: {
    alignSelf: "stretch",
    fontSize: 18,
    color: "#FFFFFF",
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    lineHeight: 24,
  },
  chipGrid: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    backgroundColor: "#0D0D0D",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: "#A0A0A0",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  errorText: {
    alignSelf: "flex-start",
    fontSize: 13,
    color: "#EF4444",
  },
  pressed: {
    opacity: 0.65,
  },
});
