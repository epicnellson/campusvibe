import { Image } from "expo-image";
import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ListingWithSeller } from "@/services/database.types";

function formatPrice(price: string): string {
  return price.startsWith("$") ? price : `$${price}`;
}

export type ListingCardProps = {
  listing: ListingWithSeller;
  onPress: () => void;
};

function ListingCardInner({ listing, onPress }: ListingCardProps) {
  const theme = useTheme();
  const firstPhoto =
    listing.photos && listing.photos.length > 0 ? listing.photos[0] : null;
  const [reportVisible, setReportVisible] = useState(false);
  const displayPrice = formatPrice(listing.price);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
      accessibilityLabel={`View ${listing.title}, ${displayPrice}`}
      accessibilityRole="button"
    >
      {firstPhoto ? (
        <Image
          source={{ uri: firstPhoto }}
          style={styles.image}
          contentFit="cover"
          placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
        />
      ) : (
        <ThemedView style={styles.imagePlaceholder}>
          <ThemedText type="small" themeColor="textSecondary">
            No photo
          </ThemedText>
        </ThemedView>
      )}
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          setReportVisible(true);
        }}
        style={styles.reportOverlay}
        accessibilityLabel="Report this listing"
        accessibilityRole="button"
        hitSlop={10}
      >
        <ThemedText style={styles.reportOverlayText}>...</ThemedText>
      </Pressable>

      <ThemedView style={styles.info}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {listing.title}
        </ThemedText>
        <ThemedText style={styles.price}>
          {displayPrice}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {listing.category}
        </ThemedText>
      </ThemedView>

      <ReportModal
        visible={reportVisible}
        contentId={listing.id}
        contentType="listing"
        onClose={() => setReportVisible(false)}
      />
    </Pressable>
  );
}

export const ListingCard = memo(ListingCardInner);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    maxWidth: "48%",
  },
  image: {
    width: "100%",
    height: 130,
  },
  imagePlaceholder: {
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: spacing.sm,
    gap: 2,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  price: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  reportOverlay: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  reportOverlayText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
});
