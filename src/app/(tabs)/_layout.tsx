import { Redirect, Tabs } from "expo-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { VerificationBanner } from "@/components/verification-banner";
import { CustomTabBar } from "@/components/custom-tab-bar";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { spacing, fontSize } from "@/theme";

export default function TabLayout() {
  const { session, isLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  if (isLoading || profileLoading) return null;
  if (!session) return <Redirect href="/" />;
  if (!profile) return <Redirect href="/onboarding" />;

  if (profile.banned) {
    return (
      <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <ThemedText style={{ fontSize: fontSize.xxl, fontWeight: "700" }}>Account Suspended</ThemedText>
        <ThemedText style={{ textAlign: "center", marginTop: 12, color: "#666", fontSize: fontSize.sm }}>
          Your account has been suspended. Please contact the campus administration.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ErrorBoundary>
      <ThemedView style={{ flex: 1 }}>
        <VerificationBanner status={profile.verification_status} />
        <Tabs
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Feed" }} />
          <Tabs.Screen name="events" options={{ title: "Events" }} />

          <Tabs.Screen name="marketplace" options={{ title: "Marketplace" }} />
          <Tabs.Screen name="chats" options={{ title: "Chats" }} />
          <Tabs.Screen name="profile" options={{ title: "Profile" }} />
          <Tabs.Screen name="explore" options={{ href: null }} />
        </Tabs>
      </ThemedView>
    </ErrorBoundary>
  );
}
