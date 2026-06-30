import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { MaxContentWidth, Spacing } from "@/constants/theme";

export default function PrivacyScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title">Privacy Policy</ThemedText>
          <ThemedText style={styles.effective}>Last updated: June 2026</ThemedText>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>1. Information We Collect</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              When you create an account, we collect your university email address, name,
              academic department, year of study, and optionally a profile photo. We also
              collect content you post, messages you send, and your interactions with other
              users (likes, RSVPs, follows).
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>2. How We Use Your Information</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              Your information is used to provide and improve CampusVibe services: display
              your profile, show your posts in the feed, connect you with classmates, send
              notifications, and moderate content. We do not sell your personal data to third
              parties.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>3. Data Sharing</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              Your profile information (name, department, year, photo) is visible to other
              users within your university domain. Anonymous confessions do not reveal your
              identity. We may share data with service providers (Supabase for database
              hosting, OpenAI for content moderation) who are contractually bound to protect
              your data.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>4. Data Retention & Deletion</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              We retain your data while your account is active. You can request account
              deletion by contacting us at privacy@campusvibe.app. Upon deletion, your
              profile, posts, and messages will be removed within 30 days.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>5. Push Notifications</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              With your permission, we send push notifications for likes, messages, events,
              and trending confessions. You can manage these preferences in the app settings
              at any time.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>6. Third-Party Services</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              We use Supabase for authentication and data storage, and the OpenAI Moderation
              API to screen content before posting. These services operate under their own
              privacy policies.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>7. Age Restriction</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              CampusVibe is intended for users aged 16 and older. We do not knowingly
              collect data from anyone under 16. If we become aware that a user is under 16,
              we will delete their account and data.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.heading}>8. Contact</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.body}>
              For privacy inquiries, contact us at privacy@campusvibe.app.
            </ThemedText>
          </ThemedView>
        </ScrollView>

        <ThemedView style={styles.footer}>
          <Button title="Back" variant="secondary" onPress={() => router.back()} />
        </ThemedView>
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
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  effective: {
    fontSize: 14,
    color: "#888",
  },
  section: {
    gap: Spacing.one,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    padding: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.3)",
  },
});
