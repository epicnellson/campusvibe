import { Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import { Animated as RNAnimated, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DepartmentYearStep } from "@/components/onboarding/department-year-step";
import { FeaturesStep } from "@/components/onboarding/features-step";
import { NamePhotoStep } from "@/components/onboarding/name-photo-step";
import { SuggestedUsersStep } from "@/components/onboarding/suggested-users-step";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { joinDefaultChannels } from "@/services/chats";
import { createProfile, updateProfile } from "@/services/profile";
import { uploadProfilePhoto } from "@/services/storage";

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { session, isLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollY = useRef(new RNAnimated.Value(0)).current;

  if (isLoading || profileLoading) return null;
  if (!session) return <Redirect href="/" />;
  if (profile) return <Redirect href="/(tabs)" />;

  const handleSkip = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      setError(null);
    } else {
      handleFinish();
    }
  };

  const handleNext = async () => {
    if (step === 1 && !department && !year) {
      setStep(2);
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      setError(null);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const profileData = await createProfile({
        name: name.trim() || "Student",
        department: department || "Other",
        year: year || "Freshman",
      });

      if (photoUri) {
        const url = await uploadProfilePhoto(profileData.id, photoUri).catch(() => null);
        if (url) {
          await updateProfile(profileData.id, { avatar_url: url }).catch(() => {});
        }
      }

      await joinDefaultChannels(profileData.id, department || "Other").catch(() => {});

      router.replace("/verify-student-id" as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
      setSaving(false);
    }
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <ThemedView style={styles.progressContainer}>
            <ThemedView style={styles.progressTrack}>
              <ThemedView style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
            </ThemedView>
            <ThemedText style={styles.progressText} themeColor="textSecondary">
              {step + 1} / {TOTAL_STEPS}
            </ThemedText>
          </ThemedView>

          {step === 0 && (
            <NamePhotoStep
              name={name}
              onNameChange={(t) => { setName(t); setError(null); }}
              photoUri={photoUri}
              onPhotoChange={setPhotoUri}
            />
          )}
          {step === 1 && (
            <DepartmentYearStep
              department={department}
              year={year}
              onDepartmentChange={(d) => { setDepartment(d); setError(null); }}
              onYearChange={(y) => { setYear(y); setError(null); }}
            />
          )}
          {step === 2 && <FeaturesStep />}
          {step === 3 && (
            <SuggestedUsersStep department={department || undefined} onComplete={handleFinish} />
          )}

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <ThemedView style={styles.actions}>
            <Button
              title={
                step === TOTAL_STEPS - 1
                  ? saving ? "Getting started..." : "Get started!"
                  : "Next"
              }
              onPress={handleNext}
              disabled={saving}
              size="lg"
            />
            <TouchableOpacity onPress={handleSkip} disabled={saving}>
              <ThemedText style={styles.skip} themeColor="textSecondary">
                Skip
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "flex-start",
    gap: spacing.lg,
    paddingTop: spacing.xl * 2,
  },
  progressContainer: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(128,128,128,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    width: 40,
    textAlign: "right",
  },
  actions: {
    gap: spacing.md,
    alignItems: "center",
  },
  skip: {
    fontSize: fontSize.md,
    paddingVertical: spacing.sm,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
