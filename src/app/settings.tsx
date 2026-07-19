import { useState } from "react";
import { Pressable, StyleSheet, View, ScrollView, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useRefresh } from "@/hooks/use-refresh";
import { useIsDarkMode } from "@/hooks/use-theme";
import { supabase } from "@/services/supabase";

export default function SettingsScreen() {
  const { profile } = useProfile();
  const { triggerFeedRefresh } = useRefresh();
  const isDark = useIsDarkMode();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    const doLogout = async () => {
      setLoggingOut(true);
      await supabase.auth.signOut();
      triggerFeedRefresh();
      router.replace("/login");
    };
    if (Platform.OS === "web") {
      Alert.alert(
        "Log Out",
        "Are you sure you want to log out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: doLogout },
        ]
      );
    } else {
      Alert.alert("Log Out", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
            <ThemedText style={styles.headerTitle}>Settings</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile summary */}
          <View style={styles.profileSummary}>
            <ThemedText style={styles.profileName}>
              {profile?.name ?? "Your Profile"}
            </ThemedText>
            {profile?.email_domain && (
              <ThemedText style={styles.profileEmail}>{profile.email_domain}</ThemedText>
            )}
          </View>

          {/* Account section */}
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <View style={styles.card}>
            <Pressable
              onPress={() => { router.back(); router.push("/edit-profile"); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="person-outline" size={20} color="#A1A1AA" />
                <ThemedText style={styles.rowLabel}>Edit Profile</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#52525B" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              onPress={() => { router.back(); router.push("/verify-student-id"); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="school-outline" size={20} color="#A1A1AA" />
                <ThemedText style={styles.rowLabel}>Student ID</ThemedText>
              </View>
              <View style={styles.rowRight}>
                <ThemedText style={[
                  styles.badge,
                  profile?.verification_status === "approved" && styles.badgeApproved,
                  profile?.verification_status === "pending" && styles.badgePending,
                ]}>
                  {profile?.verification_status === "approved" ? "Verified" :
                   profile?.verification_status === "pending" ? "Pending" : "Not Verified"}
                </ThemedText>
                <Ionicons name="chevron-forward" size={18} color="#52525B" />
              </View>
            </Pressable>
          </View>

          {/* Notifications section */}
          <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>
          <View style={styles.card}>
            <Pressable
              onPress={() => { router.back(); router.push("/notification-settings"); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="notifications-outline" size={20} color="#A1A1AA" />
                <ThemedText style={styles.rowLabel}>Notification Settings</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#52525B" />
            </Pressable>
          </View>

          {/* Appearance section */}
          <ThemedText style={styles.sectionTitle}>Appearance</ThemedText>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={20} color="#A1A1AA" />
                <ThemedText style={styles.rowLabel}>{isDark ? "Dark Mode" : "Light Mode"}</ThemedText>
              </View>
              <ThemedText style={styles.hint}>Follows system</ThemedText>
            </View>
          </View>

          {/* About section */}
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <View style={styles.card}>
            <Pressable
              onPress={() => { router.back(); router.push("/privacy"); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="document-text-outline" size={20} color="#A1A1AA" />
                <ThemedText style={styles.rowLabel}>Privacy Policy</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#52525B" />
            </Pressable>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="information-circle-outline" size={20} color="#A1A1AA" />
                <ThemedText style={styles.rowLabel}>Version</ThemedText>
              </View>
              <ThemedText style={styles.hint}>1.0.0</ThemedText>
            </View>
          </View>

          {/* Logout button */}
          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <ThemedText style={styles.logoutText}>
              {loggingOut ? "Logging out..." : "Log Out"}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scroll: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: Spacing.three,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  profileSummary: {
    alignItems: "center",
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: "#71717A",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    fontSize: 16,
    color: "#E1E1E1",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1E1E1E",
    marginLeft: 48,
  },
  hint: {
    fontSize: 14,
    color: "#71717A",
  },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  badgeApproved: {
    color: "#22C55E",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  badgePending: {
    color: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: Spacing.four,
    marginBottom: Spacing.six,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  pressed: {
    opacity: 0.5,
  },
});
