import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { spacing } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { fetchUserPosts } from "@/services/profile";
import { resolveImageUrl } from "@/services/storage";
import { db_ops } from "@/services/db";
import { auth } from "@/services/firebase";
import { signOut } from "@/services/auth";
import type { PostWithProfile, ListingWithSeller } from "@/services/database.types";
import { joinDate } from "@/utils/date";

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_PADDING = 2;
const AVATAR_SIZE = 88;

type ActiveTab = "posts" | "listings" | "about";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  inner: {
    flex: 1,
    maxWidth: 800,
    width: "100%",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#222",
  },
  skeletonBlock: {
    height: 14,
    borderRadius: 7,
    backgroundColor: "#222",
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "#000000",
    zIndex: 10,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 4,
  },
  avatarWrapper: {
    position: "relative",
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    borderWidth: 3,
    borderColor: "#000000",
    overflow: "visible",
    marginBottom: 6,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  metaText: {
    fontSize: 14,
    color: "#71717A",
    marginTop: 2,
  },
  joinedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  joinedText: {
    fontSize: 13,
    color: "#71717A",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statNumber: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 14,
    color: "#71717A",
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#3A3A3A",
    marginHorizontal: 6,
  },
  editBtn: {
    height: 34,
    paddingHorizontal: 48,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E1E",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
    position: "relative",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  tabContent: {
    minHeight: 200,
  },
  tabEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#3A3A3A",
  },
  mediaGrid: {
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  mediaRow: {
    flexDirection: "row",
    gap: GRID_GAP,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  tileTextContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 6,
    justifyContent: "center",
  },
  tileText: {
    fontSize: 11,
    lineHeight: 14,
    color: "#A0A0A0",
    textAlign: "center",
  },
  gridWrapper: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  gridCard: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0A0A0A",
  },
  gridImageBg: {
    height: 110,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridInfo: {
    padding: 8,
    gap: 2,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E1E1E1",
  },
  gridPrice: {
    fontSize: 13,
    fontWeight: "700",
  },
  aboutSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  aboutLabel: {
    fontSize: 15,
    color: "#71717A",
  },
  aboutValue: {
    fontSize: 15,
    color: "#E1E1E1",
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#262626",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSheetLabel: {
    fontSize: 16,
    color: "#E1E1E1",
    fontWeight: "500",
  },
  actionSheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#262626",
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: "#71717A",
    fontWeight: "500",
  },
});

export default function ProfileScreen() {
  const colors = useTheme();
  const { session } = useSession();
  const { profile, isLoading } = useProfile();
  const { width: rawScreenWidth } = useWindowDimensions();
  const screenWidth = Math.min(rawScreenWidth, 800);
  const userId = session?.user?.id;
  const TILE_SIZE = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [userListings, setUserListings] = useState<ListingWithSeller[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("posts");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const tabIndicator = useRef(new Animated.Value(0)).current;
  const TABS: ActiveTab[] = ["posts", "listings", "about"];
  const TAB_WIDTH = screenWidth / TABS.length;

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
      const [followerData, followingData, listingsData] = await Promise.all([
        db_ops.query("follows", {
          conditions: [{ field: "following_id", op: "==", value: userId }],
        }),
        db_ops.query("follows", {
          conditions: [{ field: "follower_id", op: "==", value: userId }],
        }),
        db_ops.query("listings", {
          conditions: [{ field: "user_id", op: "==", value: userId }],
          orderBy: [{ field: "created_at", direction: "desc" }],
        }),
      ]);
      setFollowerCount(followerData.length);
      setFollowingCount(followingData.length);

      const userIds = [...new Set(listingsData.map((l) => l.user_id).filter(Boolean))];
      const profiles = await Promise.all(userIds.map((id) => db_ops.get("profiles", id)));
      const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p]));

      setUserListings(
        listingsData.map((l) => ({
          ...l,
          seller: profileMap.get(l.user_id) ? { name: profileMap.get(l.user_id)!.name } : null,
        })) as unknown as ListingWithSeller[]
      );
    } catch (e) {
      console.warn("Failed to load stats:", e);
    }
  }, [userId]);

  useEffect(() => {
    loadPosts();
    loadStats();
  }, [loadPosts, loadStats]);

  const handleTabPress = (tab: ActiveTab) => {
    const idx = TABS.indexOf(tab);
    Animated.spring(tabIndicator, {
      toValue: idx * TAB_WIDTH,
      friction: 8,
      tension: 80,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    setActiveTab(tab);
  };

  const handleShare = () => {
    Share.share({ message: `Check out ${profile?.name ?? "my profile"} on CampusVibe!` });
  };

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      router.replace("/login");
    } catch {
      Alert.alert("Error", "Could not log out. Please try again.");
    }
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.skeletonAvatar} />
        <View style={[styles.skeletonBlock, { width: 120, height: 16, marginTop: 16 }]} />
        <View style={[styles.skeletonBlock, { width: 80, height: 12, marginTop: 8 }]} />
        <View style={[styles.skeletonBlock, { width: 200, height: 12, marginTop: 8 }]} />
      </View>
    );
  }

  const avatarUri = resolveImageUrl(profile?.avatar_url, "profile-photos");

  const renderPostsTab = () => {
    if (postsLoading) {
      return (
        <View style={styles.tabEmpty}>
          <View style={styles.skeletonGrid}>
            {[...Array(6)].map((_, i) => (
              <View key={i} style={[styles.skeletonBlock, { width: TILE_SIZE, height: TILE_SIZE }]} />
            ))}
          </View>
        </View>
      );
    }
    if (posts.length === 0) {
      return (
        <View style={styles.tabEmpty}>
          <Ionicons name="camera-outline" size={40} color={colors.border} />
          <ThemedText style={styles.emptyText}>No posts yet</ThemedText>
        </View>
      );
    }

    const rows: PostWithProfile[][] = [];
    for (let i = 0; i < posts.length; i += GRID_COLUMNS) {
      rows.push(posts.slice(i, i + GRID_COLUMNS));
    }

    return (
      <View style={styles.mediaGrid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.mediaRow}>
            {row.map((post) => {
              const img = resolveImageUrl(post.image_url, "post-images");
              return (
                <Pressable
                  key={post.id}
                  onPress={() => router.push(`/post/${post.id}`)}
                  style={({ pressed }) => [
                    { width: TILE_SIZE, height: TILE_SIZE, backgroundColor: "#0A0A0A", overflow: "hidden" as const },
                    pressed && styles.pressed,
                  ]}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.tileImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.tileTextContainer}>
                      <ThemedText numberOfLines={4} style={styles.tileText}>
                        {post.content}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {row.length < GRID_COLUMNS &&
              Array.from({ length: GRID_COLUMNS - row.length }).map((_, i) => (
                <View key={`empty-${i}`} style={{ width: TILE_SIZE, height: TILE_SIZE, backgroundColor: "#0A0A0A" }} />
              ))}
          </View>
        ))}
      </View>
    );
  };

  const renderListingsTab = () => {
    if (userListings.length === 0) {
      return (
        <View style={styles.tabEmpty}>
          <Ionicons name="pricetag-outline" size={40} color={colors.border} />
          <ThemedText style={styles.emptyText}>No listings yet</ThemedText>
        </View>
      );
    }
    const rows: ListingWithSeller[][] = [];
    for (let i = 0; i < userListings.length; i += 2) {
      rows.push(userListings.slice(i, i + 2));
    }
    return (
      <View style={styles.gridWrapper}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/listing/${item.id}`)}
                style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
              >
                <View style={styles.gridImageBg}>
                  {item.photos?.[0] ? (
                    <Image
                      source={{ uri: resolveImageUrl(item.photos[0], "listing-images") ?? undefined }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="image-outline" size={28} color={colors.inputBorder} />
                  )}
                </View>
                <View style={styles.gridInfo}>
                  <ThemedText numberOfLines={1} style={styles.gridTitle}>{item.title}</ThemedText>
                  <ThemedText style={[styles.gridPrice, { color: colors.primary }]}>
                    {item.price.startsWith("$") ? item.price : `$${item.price}`}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
            {row.length < 2 && <View style={styles.gridCard} />}
          </View>
        ))}
      </View>
    );
  };

  const renderAboutTab = () => (
    <View style={styles.aboutSection}>
      {[
        { label: "Department", value: profile?.department ?? "Not set" },
        { label: "Year", value: profile?.year ?? "Not set" },
        { label: "Verification", value: isVerified ? "Verified Student" : "Pending" },
        { label: "Joined", value: profile?.created_at ? joinDate(profile.created_at) : "Unknown" },
      ].map(({ label, value }) => (
        <View key={label} style={[styles.aboutRow, { borderBottomColor: colors.divider }]}>
          <ThemedText style={styles.aboutLabel}>{label}</ThemedText>
          <ThemedText style={[styles.aboutValue, label === "Verification" && isVerified && { color: "#22C55E" }]}>
            {value}
          </ThemedText>
        </View>
      ))}
      <Pressable
        onPress={() => router.push("/notification-settings")}
        style={({ pressed }) => [styles.aboutRow, { borderBottomColor: colors.divider }, pressed && styles.pressed]}
      >
        <ThemedText style={styles.aboutLabel}>Notification Settings</ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <ThemedText style={styles.aboutValue}>Manage</ThemedText>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        stickyHeaderIndices={[0]}
      >
        {/* Sticky top-bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setShowProfileMenu(true)}
            style={({ pressed }) => [styles.topBarBtn, pressed && styles.pressed]}
            accessibilityLabel="Profile menu"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textOnDark} />
          </Pressable>
        </View>

        {/* Centered profile info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <Avatar uri={avatarUri ?? undefined} name={profile?.name ?? "?"} size={AVATAR_SIZE} />
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.nameRow}>
            <ThemedText style={styles.name}>{profile?.name ?? "Unknown"}</ThemedText>
            {isVerified && (
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{ marginLeft: 4 }} />
            )}
          </View>

          <ThemedText style={styles.metaText}>
            {[profile?.department, profile?.year].filter(Boolean).join(" · ")}
          </ThemedText>

          {profile?.created_at && (
            <View style={styles.joinedRow}>
              <Ionicons name="calendar-outline" size={13} color="#71717A" />
              <ThemedText style={styles.joinedText}>{joinDate(profile.created_at)}</ThemedText>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{followingCount}</ThemedText>
              <ThemedText style={styles.statLabel}> Following</ThemedText>
            </View>
            <View style={styles.statDot} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{followerCount}</ThemedText>
              <ThemedText style={styles.statLabel}> Followers</ThemedText>
            </View>
            <View style={styles.statDot} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>{posts.length}</ThemedText>
              <ThemedText style={styles.statLabel}> Posts</ThemedText>
            </View>
          </View>

          {/* Edit Profile button */}
          <Pressable
            onPress={() => router.push("/edit-profile")}
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          >
            <ThemedText style={styles.editBtnText}>Edit Profile</ThemedText>
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => handleTabPress(tab)}
              style={styles.tab}
              accessibilityLabel={`${tab} tab`}
              accessibilityRole="tab"
            >
              <Ionicons
                name={
                  tab === "posts" ? "grid-outline" :
                  tab === "listings" ? "pricetag-outline" :
                  "person-outline"
                }
                size={22}
                color={activeTab === tab ? colors.textOnDark : colors.muted}
              />
            </Pressable>
          ))}
          <Animated.View style={[styles.tabIndicator, { width: TAB_WIDTH, left: tabIndicator, backgroundColor: colors.primary }]} />
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === "posts" && renderPostsTab()}
          {activeTab === "listings" && renderListingsTab()}
          {activeTab === "about" && renderAboutTab()}
        </View>
      </ScrollView>
      </View>

      {/* Profile 3-dot menu */}
      <Modal visible={showProfileMenu} transparent animationType="fade" onRequestClose={() => setShowProfileMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowProfileMenu(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Pressable
              onPress={() => { setShowProfileMenu(false); router.push("/settings"); }}
              style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}
            >
              <Ionicons name="settings-outline" size={20} color={colors.textBody} />
              <ThemedText style={styles.actionSheetLabel}>Settings</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => { setShowProfileMenu(false); handleShare(); }}
              style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}
            >
              <Ionicons name="share-outline" size={20} color={colors.textBody} />
              <ThemedText style={styles.actionSheetLabel}>Share Profile</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => { setShowProfileMenu(false); handleLogout(); }}
              style={({ pressed }) => [styles.actionSheetItem, pressed && styles.pressed]}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <ThemedText style={[styles.actionSheetLabel, { color: colors.danger }]}>Log Out</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowProfileMenu(false)}
              style={({ pressed }) => [styles.actionSheetCancel, pressed && styles.pressed]}
            >
              <ThemedText style={styles.actionSheetCancelText}>Cancel</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
