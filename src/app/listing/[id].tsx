import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { getOrCreateDMChannel } from "@/services/chats";
import { supabase } from "@/services/supabase";
import type { ListingWithSeller } from "@/services/database.types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.4;

function formatPrice(price: string): string {
  return price.startsWith("$") ? price : `$${price}`;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = id!;
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);

        const { data } = await supabase
          .from("listings")
          .select(
            `
            id,
            title,
            description,
            price,
            category,
            photos,
            created_at,
            user_id,
            seller:user_id(name)
          `
          )
          .eq("id", listingId)
          .single();

        setListing(data as unknown as ListingWithSeller);
      } catch (e) {
        console.warn("Failed to load listing:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [listingId]);

  const handleMessageSeller = async () => {
    if (!currentUserId || !listing) return;
    try {
      const channelId = await getOrCreateDMChannel(
        currentUserId,
        listing.user_id
      );
      router.push(`/chat/${channelId}`);
    } catch (e) {
      console.warn("Failed to create DM:", e);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!listing) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Listing not found</ThemedText>
      </ThemedView>
    );
  }

  const isOwn = listing.user_id === currentUserId;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>{"<"}</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
            {listing.title}
          </ThemedText>
        </ThemedView>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {listing.photos && listing.photos.length > 0 && (
            <Image
              source={{ uri: listing.photos[0] }}
              style={styles.mainImage}
              contentFit="cover"
            />
          )}

          <ThemedView style={styles.details}>
            <ThemedText type="title" style={styles.title}>
              {listing.title}
            </ThemedText>

            <ThemedText style={styles.price}>
              {formatPrice(listing.price)}
            </ThemedText>

            <ThemedView style={styles.badge}>
              <ThemedText type="small" style={styles.badgeText}>
                {listing.category}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.sellerSection}>
              <Avatar
                uri={null}
                name={listing.seller?.name ?? "?"}
                size={36}
              />
              <ThemedView style={styles.sellerInfo}>
                <ThemedText type="smallBold">
                  {listing.seller?.name ?? "Unknown"}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Seller
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.divider} />

            <ThemedText style={styles.sectionTitle}>Description</ThemedText>
            <ThemedText style={styles.description}>
              {listing.description}
            </ThemedText>

            <Pressable
              onPress={() => setReportVisible(true)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <ThemedText type="small" themeColor="textSecondary" style={styles.reportLink}>
                Report this listing
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>

        {!isOwn && (
          <ThemedView style={styles.footer}>
            <Pressable
              onPress={handleMessageSeller}
              style={({ pressed }) => [
                styles.messageButton,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText style={styles.messageButtonText}>
                Message Seller
              </ThemedText>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundElement,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 20,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.lg,
  },
  mainImage: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: colors.backgroundElement,
  },
  details: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
  },
  price: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.backgroundElement,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    color: colors.primary,
    fontWeight: "600",
  },
  sellerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sellerInfo: {
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  description: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  messageButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  messageButtonText: {
    color: "#ffffff",
    fontWeight: fontWeight.semibold,
    fontSize: 16,
  },
  reportLink: {
    marginTop: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
