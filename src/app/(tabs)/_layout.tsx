import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { VerificationBanner } from "@/components/verification-banner";
import { CustomTabBar } from "@/components/custom-tab-bar";
import { SwipeablePager, PagerViewRef } from "@/components/PagerViewWrapper";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { spacing } from "@/theme";

import FeedScreen from "./index";
import ChatsScreen from "./chats";
import MarketplaceScreen from "./marketplace";
import ProfileScreen from "./profile";

export default function TabLayout() {
  const { session, isLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerViewRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onTabPress = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
  }, []);

  const onPageChange = useCallback((position: number) => {
    setActiveIndex(position);
  }, []);

  if (isLoading || profileLoading) return null;
  if (!session) return <Redirect href="/" />;
  if (!profile) return <Redirect href="/onboarding" />;

  if (profile.banned) {
    return (
      <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <ThemedText style={{ fontSize: 22, fontWeight: "700" }}>
          Account Suspended
        </ThemedText>
        <ThemedText style={{ textAlign: "center", marginTop: 12, color: "#666", fontSize: 13 }}>
          Your account has been suspended. Please contact the campus administration.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ErrorBoundary>
      <ThemedView style={styles.root}>
        <View style={[styles.headerArea, { paddingTop: insets.top }]}>
          <VerificationBanner status={profile.verification_status} />
        </View>

        <SwipeablePager
          ref={pagerRef}
          activeIndex={activeIndex}
          onPageChange={onPageChange}
        >
          <View style={styles.page} key="feed"><FeedScreen /></View>
          <View style={styles.page} key="chats"><ChatsScreen /></View>
          <View style={styles.page} key="marketplace"><MarketplaceScreen /></View>
          <View style={styles.page} key="profile"><ProfileScreen /></View>
        </SwipeablePager>

        <CustomTabBar activeIndex={activeIndex} onTabPress={onTabPress} />
      </ThemedView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerArea: {
    zIndex: 10,
  },
  page: {
    flex: 1,
  },
});
