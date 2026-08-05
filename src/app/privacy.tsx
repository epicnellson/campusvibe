import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";


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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E1E1E",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  effective: {
    fontSize: 14,
    color: "#71717A",
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
});

export default function PrivacyScreen() {
  const colors = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textOnDark} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Privacy Policy</ThemedText>
        </ThemedView>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
      </SafeAreaView>
    </ThemedView>
  );
}
