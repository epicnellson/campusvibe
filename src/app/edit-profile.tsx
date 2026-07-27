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
import { spacing } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { updateProfile } from "@/services/profile";
import { uploadProfilePhoto } from "@/services/storage";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/retry";

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
    backgroundColor: "#6C47FF",
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
    backgroundColor: "#141414",
  },
  progressFill: {
    height: 2,
    backgroundColor: "#6C47FF",
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
    backgroundColor: "#6C47FF",
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
    backgroundColor: "#000000",
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
    backgroundColor: "#000000",
  },
  chipActive: {
    backgroundColor: "#6C47FF",
    borderColor: "#6C47FF",
  },
  chipText: {
    fontSize: 14,
    color: "#A1A1A6",
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

export default function EditProfileScreen() {
  const colors = useTheme();
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading, refreshProfile } = useProfile();
  const userId = session?.user?.id;
  const toast = useToast();

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: 12 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.skeleton }} />
        <View style={{ width: 140, height: 14, borderRadius: 7, backgroundColor: colors.skeleton }} />
        <View style={{ width: 100, height: 12, borderRadius: 6, backgroundColor: colors.skeleton }} />
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
    } catch (err) {
      setUploading(false);
      toast.show(getErrorMessage(err), "error");
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
      router.canGoBack() ? router.back() : router.replace("/");
    } catch (err) {
      toast.show(getErrorMessage(err), "error");
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
              if (step === "name") { router.canGoBack() ? router.back() : router.replace("/"); }
              else if (step === "department") setStep("name");
              else setStep("department");
              setError(null);
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textOnDark} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Edit Profile</ThemedText>
          {step === "year" ? (
            <Pressable
              onPress={handleSave}
              disabled={saving || !year}
              style={({ pressed }) => [styles.saveBtn, (!year || saving) && styles.saveBtnDisabled, pressed && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnDark} />
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
                  <ActivityIndicator size="small" color={colors.textOnDark} />
                ) : (
                  <Ionicons name="camera" size={14} color={colors.textOnDark} />
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
                placeholderTextColor={colors.muted}
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
