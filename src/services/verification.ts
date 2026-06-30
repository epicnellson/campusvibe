import { Alert } from "react-native";
import { router } from "expo-router";

import type { Profile } from "@/services/database.types";

/**
 * Checks if the user's verification status allows posting/messaging.
 * Shows an alert and returns false if the user is not approved.
 */
export function requireVerified(profile: Profile | null): boolean {
  if (!profile) {
    Alert.alert(
      "Not verified",
      "Please complete onboarding first.",
      [      { text: "OK", onPress: () => router.replace("/onboarding" as any) }]
    );
    return false;
  }

  if (profile.verification_status === "approved") return true;

  if (profile.verification_status === "rejected") {
    Alert.alert(
      "ID rejected",
      "Your student ID was rejected. Please upload a new one to continue.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Upload", onPress: () => router.push("/verify-student-id" as any) },
      ]
    );
    return false;
  }

  if (profile.verification_status === "pending") {
    Alert.alert(
      "ID pending review",
      "Your student ID is being reviewed. You'll be able to post once it's approved."
    );
    return false;
  }

  // verification_status is null — hasn't uploaded yet
  Alert.alert(
    "Verify your student ID",
    "Upload your student ID card to start posting.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Upload", onPress: () => router.push("/verify-student-id" as any) },
    ]
  );
  return false;
}
