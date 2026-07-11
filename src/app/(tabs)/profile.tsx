import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/Avatar";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { fetchUserPosts } from "@/services/profile";
import { supabase } from "@/services/supabase";
import type { PostWithProfile, ListingWithSeller } from "@/services/database.types";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ProfileScreen() {
  const { session } = useSession();
  const { profile, isLoading } = useProfile();
  const userId = session?.user?.id;
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [userListings, setUserListings] = useState<ListingWithSeller[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "listings" | "about">("posts");

  const isVerified = profile?.verification_status === "approved";

  const loadPosts = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchUserPosts(userId);
      setPosts(data);
    } catch (e) {
      console.warn("Failed to load posts:", e);
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const [{ count: followers }, { count: following }, { data: listings }] =
        await Promise.all([
          supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("following_id", userId),
          supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", userId),
          supabase
            .from("listings")
            .select("id, title, description, price, category, photos, created_at, user_id, seller:profiles(name)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);
      setFollowerCount(followers ?? 0);
      setFollowingCount(following ?? 0);
      setUserListings((listings ?? []) as unknown as ListingWithSeller[]);
    } catch (e) {
      console.warn("Failed to load stats:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadPosts();
    loadStats();
  }, [loadPosts, loadStats]);

  const handleShare = () => {
    Share.share({ message: `Check out ${profile?.name ?? "my profile"} on CampusVibe!` });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  const renderPostsTab = () => {
    if (postsLoading) {
      return (
        <ThemedView style={styles.tabCenter}>
          <ThemedText themeColor="textSecondary">Loading posts...</ThemedText>
        </ThemedView>
      );
    }
    if (posts.length === 0) {
      return (
        <ThemedView style={styles.tabCenter}>
          <ThemedText themeColor="textSecondary">No posts yet</ThemedText>
        </ThemedView>
      );
    }
    return posts.map((item) => (
      <ThemedView key={item.id} type="backgroundElement" style={styles.postCard}>
        <ThemedText style={styles.postContent}>{item.content}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {relativeTime(item.created_at)} · {item.likes?.length ?? 0} likes
        </ThemedText>
      </ThemedView>
    ));
  };

  const renderListingsTab = () => {
    if (userListings.length === 0) {
      return (
        <ThemedView style={styles.tabCenter}>
          <ThemedText themeColor="textSecondary">No listings yet</ThemedText>
        </ThemedView>
      );
    }
    const rows: ListingWithSeller[][] = [];
    for (let i = 0; i < userListings.length; i += 2) {
      rows.push(userListings.slice(i, i + 2));
    }
    return rows.map((row, ri) => (
      <View key={ri} style={styles.gridRow}>
        {row.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/listing/${item.id}`)}
            style={({ pressed }) => [
              styles.gridCard,
              pressed && styles.pressed,
            ]}
          >
            <ThemedView style={styles.gridImagePlaceholder}>
              {item.photos?.[0] ? (
                <View style={styles.gridImage} />
              ) : (
                <ThemedText type="small" themeColor="textTertiary">No photo</ThemedText>
              )}
            </ThemedView>
            <ThemedView style={styles.gridInfo}>
              <ThemedText numberOfLines={1} style={styles.gridTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.gridPrice}>
                {item.price.startsWith("$") ? item.price : `$${item.price}`}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>
    ));
  };

  const renderAboutTab = () => (
    <ThemedView style={styles.aboutSection}>
      <ThemedView style={styles.aboutRow}>
        <ThemedText style={styles.aboutLabel}>Department</ThemedText>
        <ThemedText>{profile?.department ?? "Not set"}</ThemedText>
      </ThemedView>
      <ThemedView style={styles.aboutRow}>
        <ThemedText style={styles.aboutLabel}>Year</ThemedText>
        <ThemedText>{profile?.year ?? "Not set"}</ThemedText>
      </ThemedView>
      <ThemedView style={styles.aboutRow}>
        <ThemedText style={styles.aboutLabel}>Joined</ThemedText>
        <ThemedText>
          {profile?.created_at ? formatJoinDate(profile.created_at) : "Unknown"}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.avatarSection}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.name ?? "?"}
              size={80}
            />
          </ThemedView>

          <ThemedView style={styles.header}>
            <View style={styles.nameRow}>
              <ThemedText type="title" style={styles.name}>
                {profile?.name ?? "Unknown"}
              </ThemedText>
              {isVerified && (
                <ThemedText style={styles.verifiedInline}>✓</ThemedText>
              )}
            </View>
            <ThemedText themeColor="textSecondary" style={styles.detail}>
              {profile?.department ?? ""}
              {profile?.year ? ` · ${profile.year}` : ""}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statsRow}>
            <ThemedView style={styles.stat}>
              <ThemedText style={styles.statNumber}>{posts.length}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Posts</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText style={styles.statNumber}>{followerCount}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Followers</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText style={styles.statNumber}>{followingCount}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Following</ThemedText>
            </ThemedView>
            <ThemedView style={styles.stat}>
              <ThemedText style={styles.statNumber}>
                {profile?.created_at ? formatJoinDate(profile.created_at).split(" ")[1] : "—"}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Joined</ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.buttonRow}>
            <Button
              title="Edit Profile"
              variant="secondary"
              style={styles.actionButton}
              onPress={() => router.push("/edit-profile")}
            />
            <Button
              title="Share"
              variant="secondary"
              style={styles.actionButton}
              onPress={handleShare}
            />
          </ThemedView>

          <ThemedView style={styles.tabBar}>
            {(["posts", "listings", "about"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tab,
                  activeTab === tab && styles.tabActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView style={styles.tabContent}>
            {activeTab === "posts" && renderPostsTab()}
            {activeTab === "listings" && renderListingsTab()}
            {activeTab === "about" && renderAboutTab()}
          </ThemedView>
        </ScrollView>
      </View>
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
    width: "100%",
    paddingBottom: BottomTabInset,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  avatarSection: {
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
  },
  verifiedInline: {
    fontSize: 20,
    color: colors.secondary,
    fontWeight: fontWeight.bold,
  },
  detail: {
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundElement,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: "#ffffff",
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  tabCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  postCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  postContent: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gridCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: colors.backgroundElement,
  },
  gridImagePlaceholder: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSelected,
  },
  gridImage: {
    width: "100%",
    height: 100,
    backgroundColor: colors.backgroundSelected,
  },
  gridInfo: {
    padding: spacing.sm,
    gap: 2,
  },
  gridTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  gridPrice: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  aboutSection: {
    gap: spacing.md,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  aboutLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
