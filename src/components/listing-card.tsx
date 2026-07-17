import { Image } from "expo-image";
import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
        <View style={styles.imagePlaceholder}>
          <ThemedText style={{ color: "#52525B", fontSize: 13 }}>
            No photo
          </ThemedText>
        </View>
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

      <View style={styles.info}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {listing.title}
        </ThemedText>
        <ThemedText style={styles.price}>
          {displayPrice}
        </ThemedText>
        <ThemedText style={{ color: "#71717A", fontSize: 12 }} numberOfLines={1}>
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
    backgroundColor: "#121214",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  imagePlaceholder: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0C",
  },
  noPhotoText: {
    fontSize: 12,
    color: "#52525B",
  },
  info: {
    padding: 12,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6C47FF",
  },
  category: {
    fontSize: 12,
    color: "#71717A",
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
