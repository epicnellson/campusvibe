import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Dimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/components/ui/Avatar";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ListingSkeleton } from "@/components/feed-skeleton";
import { MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { getOrCreateDMChannel } from "@/services/chats";
import { db_ops } from "@/services/db";
import { resolveImageUrl } from "@/services/storage";
import type { ListingWithSeller } from "@/services/database.types";
import { timeAgo } from "@/utils/date";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/retry";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.4;

function formatPrice(price: string): string {
  return price.startsWith("$") ? price : `$${price}`;
}

export default function ListingDetailScreen() {
  const colors = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { session } = useSession();
  const toast = useToast();
  // Normalize the route param to a single string. useLocalSearchParams may
  // return `string | string[]`, and a missing id must not crash the lookup.
  const listingId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id) && params.id.length > 0
        ? params.id[0]
        : "";
  const currentUserId = session?.user?.id;

  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sellerAvatar, setSellerAvatar] = useState<string | null>(null);
  const [otherListings, setOtherListings] = useState<ListingWithSeller[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!listingId) return;
        let listingData = await db_ops.get("listings", listingId);
        if (!listingData) {
          // Fallback fetch: listings are returned as `{ id: docId, ...data }`,
          // so a stored `id` field can shadow the Firestore document id. Match
          // with String() coercion against the route id to find the doc either way.
          const candidates = await db_ops.query("listings", { limitCount: 200 });
          listingData = candidates.find((c: any) => String(c.id) === String(listingId)) ?? null;
        }
        if (!listingData) return;

        setListing({
          ...listingData,
          seller: null,
        } as unknown as ListingWithSeller);

        // Secondary lookups run independently and must never block the listing
        // from rendering: a permission/index error on one (e.g. saved_listings)
        // previously failed the whole load and surfaced as "Listing not found".
        const loadSeller = async () => {
          try {
            const sellerProfile = await db_ops.get("profiles", listingData.user_id);
            if (!sellerProfile) return;
            setSellerAvatar(sellerProfile.avatar_url ?? null);
            setListing((prev) =>
              prev ? { ...prev, seller: { name: sellerProfile.name, id: sellerProfile.id } } : prev
            );
            const sellerListings = (await db_ops
              .query("listings", {
                conditions: [{ field: "user_id", op: "==", value: listingData.user_id }],
                orderBy: [{ field: "created_at", direction: "desc" }],
                limitCount: 5,
              })
              .catch(() => [])) as any[];
            setOtherListings(
              sellerListings
                .filter((l: any) => String(l.id) !== String(listingId))
                .slice(0, 4)
                .map((l: any) => ({
                  ...l,
                  seller: { name: sellerProfile.name },
                })) as unknown as ListingWithSeller[]
            );
          } catch {
            // seller info is best-effort; the listing still renders
          }
        };

        const loadSaved = async () => {
          try {
            if (!currentUserId) return;
            const savedCheck = await db_ops.query("saved_listings", {
              conditions: [
                { field: "user_id", op: "==", value: currentUserId },
                { field: "listing_id", op: "==", value: listingId },
              ],
            });
            setSaved(savedCheck.length > 0);
          } catch {
            // saved status is best-effort; the listing still renders
          }
        };

        loadSeller();
        loadSaved();
      } catch (e) {
        console.warn("Failed to load listing:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [listingId, currentUserId]);

  const handleMessageSeller = useCallback(async () => {
    if (!currentUserId || !listing) return;
    try {
      const channelId = await getOrCreateDMChannel(currentUserId, listing.user_id);
      router.push(`/chat/${channelId}`);
    } catch (err) {
      toast.show(getErrorMessage(err), "error");
    }
  }, [currentUserId, listing]);

  const handleShare = useCallback(() => {
    if (!listing) return;
    Share.share({
      message: `${listing.title} - ${formatPrice(listing.price)} on CampusVibe`,
    });
  }, [listing]);

  const handleSave = useCallback(async () => {
    if (!currentUserId || !listing) return;
    try {
      if (saved) {
        const existing = await db_ops.query("saved_listings", {
          conditions: [
            { field: "user_id", op: "==", value: currentUserId },
            { field: "listing_id", op: "==", value: listingId },
          ],
        });
        for (const doc of existing) {
          await db_ops.delete("saved_listings", doc.id);
        }
        setSaved(false);
      } else {
        await db_ops.add("saved_listings", {
          user_id: currentUserId,
          listing_id: listingId,
        });
        setSaved(true);
      }
    } catch (err) {
      toast.show(getErrorMessage(err), "error");
    }
  }, [currentUserId, listing, saved, listingId]);

  if (loading) {
    return (
      <ListingSkeleton />
    );
  }

  if (!listing) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Listing not found</ThemedText>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ marginTop: 16 }}>
          <ThemedText style={{ color: colors.primary }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const isOwn = listing.user_id === currentUserId;
  const photos = listing.photos?.length > 0 ? listing.photos : [];
  const photoHeight = photos.length > 0 ? IMAGE_HEIGHT : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
            {listing.title}
          </ThemedText>
          <View style={styles.headerActions}>
            <Pressable onPress={handleShare} style={styles.headerAction}>
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            </Pressable>
            {!isOwn && (
              <Pressable onPress={handleSave} style={styles.headerAction}>
                <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={20} color={saved ? colors.primary : "#FFFFFF"} />
              </Pressable>
            )}
          </View>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {photos.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setActiveImageIndex(idx);
                }}
              >
                {photos.map((photo, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: photo }}
                    style={[styles.mainImage, { width: SCREEN_WIDTH }]}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
              {photos.length > 1 && (
                <View style={styles.pagination}>
                  {photos.map((_, idx) => (
                    <View
                      key={idx}
                      style={[styles.dot, idx === activeImageIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.mainImage, styles.noImage]}>
              <Ionicons name="image-outline" size={48} color="#3A3A3A" />
              <ThemedText style={styles.noImageText}>No photos</ThemedText>
            </View>
          )}

          <ThemedView style={styles.details}>
            <View style={styles.titleRow}>
              <ThemedText type="title" style={styles.title}>
                {listing.title}
              </ThemedText>
            </View>

            <ThemedText style={styles.price}>
              {formatPrice(listing.price)}
            </ThemedText>

            <View style={styles.badgeRow}>
              <ThemedView style={styles.badge}>
                <ThemedText type="small" style={styles.badgeText}>
                  {listing.category}
                </ThemedText>
              </ThemedView>
              {listing.created_at && (
                <ThemedText style={styles.dateText}>
                  {timeAgo(listing.created_at)}
                </ThemedText>
              )}
            </View>

            <ThemedView style={styles.divider} />

            <Pressable
              onPress={() => {
                if (listing.user_id) router.push(`/user/${listing.user_id}`);
              }}
              style={styles.sellerSection}
            >
              <Avatar
                uri={resolveImageUrl(sellerAvatar, "profile-photos") ?? undefined}
                name={listing.seller?.name ?? "?"}
                size={44}
              />
              <ThemedView style={styles.sellerInfo}>
                <ThemedText style={styles.sellerName}>
                  {listing.seller?.name ?? "Unknown"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  View seller profile
                </ThemedText>
              </ThemedView>
              <Ionicons name="chevron-forward" size={16} color="#71717A" />
            </Pressable>

            <ThemedView style={styles.divider} />

            <ThemedText style={styles.sectionTitle}>Description</ThemedText>
            <ThemedText style={styles.description}>
              {listing.description}
            </ThemedText>

            <Pressable
              onPress={() => setReportVisible(true)}
              style={({ pressed }) => [styles.reportRow, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="flag-outline" size={14} color="#71717A" />
              <ThemedText type="small" themeColor="textSecondary">
                Report this listing
              </ThemedText>
            </Pressable>
          </ThemedView>

          {otherListings.length > 0 && (
            <ThemedView style={styles.relatedSection}>
              <ThemedText style={styles.sectionTitle}>
                More from {listing.seller?.name ?? "seller"}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
                {otherListings.map((item) => {
                  const photo = item.photos?.length > 0 ? item.photos[0] : null;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(item.id) } })}
                      style={({ pressed }) => [styles.relatedCard, pressed && { opacity: 0.7 }]}
                    >
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.relatedImage} contentFit="cover" />
                      ) : (
                        <View style={[styles.relatedImage, styles.relatedNoImage]}>
                          <Ionicons name="image-outline" size={24} color="#3A3A3A" />
                        </View>
                      )}
                      <ThemedText numberOfLines={1} style={styles.relatedTitle}>{item.title}</ThemedText>
                      <ThemedText style={styles.relatedPrice}>{formatPrice(item.price)}</ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </ThemedView>
          )}
        </ScrollView>

        {!isOwn && (
          <ThemedView style={styles.footer}>
            <Pressable
              onPress={handleMessageSeller}
              style={({ pressed }) => [styles.messageButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.messageButtonText}>Message Seller</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <ReportModal
          visible={reportVisible}
          contentId={listingId}
          contentType="listing"
          onClose={() => setReportVisible(false)}
        />
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
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    flex: 1,
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    gap: 4,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingBottom: 100,
  },
  mainImage: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#121212",
  },
  noImage: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noImageText: {
    fontSize: 13,
    color: "#3A3A3A",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3A3A3A",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 18,
  },
  details: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    flex: 1,
    color: "#FFFFFF",
  },
  price: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    color: "#6C47FF",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: "#1C1C1E",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    color: "#6C47FF",
    fontWeight: "600",
  },
  dateText: {
    fontSize: 13,
    color: "#71717A",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1E1E1E",
    marginVertical: spacing.sm,
  },
  sellerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  sellerInfo: {
    flex: 1,
    gap: 2,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: "#FFFFFF",
  },
  description: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: "#9E9E9E",
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  relatedSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  relatedScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  relatedCard: {
    width: 140,
    gap: 4,
  },
  relatedImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: "#121212",
  },
  relatedNoImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  relatedPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6C47FF",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1E1E1E",
    backgroundColor: "#000000",
  },
  messageButton: {
    backgroundColor: "#6C47FF",
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  messageButtonText: {
    color: "#FFFFFF",
    fontWeight: fontWeight.semibold,
    fontSize: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
});
