import { Image } from "expo-image";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
  const firstPhoto =
    listing.photos && listing.photos.length > 0 ? listing.photos[0] : null;
  const [reportVisible, setReportVisible] = useState(false);
  const displayPrice = formatPrice(listing.price);
  const colors = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.backgroundElement }, pressed && styles.pressed]}
      accessibilityLabel={`View ${listing.title}, ${displayPrice}`}
      accessibilityRole="button"
    >
      {firstPhoto ? (
        <Image
          source={{ uri: firstPhoto }}
          style={styles.image}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: "#0A0A0C" }]}>
          <ThemedText style={{ color: colors.muted, fontSize: 13 }}>
            No photo
          </ThemedText>
        </View>
      )}
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          setReportVisible(true);
        }}
        style={[styles.reportOverlay, { backgroundColor: colors.overlay }]}
        accessibilityLabel="Report this listing"
        accessibilityRole="button"
        hitSlop={10}
      >
        <ThemedText style={[styles.reportOverlayText, { color: colors.text }]}>...</ThemedText>
      </Pressable>

      <View style={styles.info}>
        <ThemedText numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {listing.title}
        </ThemedText>
        <ThemedText style={[styles.price, { color: colors.primary }]}>
          {displayPrice}
        </ThemedText>
        <ThemedText style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {listing.category}
        </ThemedText>
      </View>

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
    borderRadius: 12,
    overflow: "hidden",
    maxWidth: "48%",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  imagePlaceholder: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noPhotoText: {
    fontSize: 12,
  },
  info: {
    padding: 12,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
  },
  category: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  reportOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  reportOverlayText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
});
