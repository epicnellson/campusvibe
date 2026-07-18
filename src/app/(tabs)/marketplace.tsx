import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";

import { ReportModal } from "@/components/report-modal";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { fetchListings } from "@/services/marketplace";
import type { ListingWithSeller } from "@/services/database.types";

const CATEGORIES = ["All", "Textbooks", "Electronics", "Clothing", "Other"] as const;

function formatPrice(price: string): string {
  return price.startsWith("$") ? price : `$${price}`;
}

export default function MarketplaceScreen() {
  const { profile } = useProfile();
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [reportVisible, setReportVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const numColumns = isWide ? 4 : 2;

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchListings();
      setListings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load listings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filtered =
    selectedCategory === "All"
      ? listings
      : listings.filter((l) => l.category === selectedCategory);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <ThemedView style={styles.headerBar}>
          <ThemedText type="title" style={styles.title}>
            Marketplace
          </ThemedText>
          <Pressable
            onPress={() => router.push("/create-listing")}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Create Listing"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </ThemedView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.filterChip,
                selectedCategory === cat && styles.filterChipActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.filterChipText,
                  selectedCategory === cat && styles.filterChipTextActive,
                ]}
              >
                {cat}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : filtered.length === 0 ? (
          <ThemedView style={styles.center}>
            <ThemedText themeColor="textSecondary">
              {selectedCategory === "All"
                ? "No listings yet. Be the first to sell!"
                : `No listings in ${selectedCategory}`}
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            key={`grid-${numColumns}-${selectedCategory}`}
            renderItem={({ item }) => {
              const firstPhoto =
                item.photos && item.photos.length > 0 ? item.photos[0] : null;
              const isSold = (item as any).sold === true;

              return (
                <Pressable
                  onPress={() => router.push(`/listing/${item.id}`)}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedView style={styles.imageWrapper}>
                    {firstPhoto ? (
                      <>
                        <Image
                          source={{ uri: firstPhoto }}
                          style={styles.image}
                          contentFit="cover"
                        />
                        <ThemedView style={styles.priceBadge}>
                          <ThemedText style={styles.priceBadgeText}>
                            {formatPrice(item.price)}
                          </ThemedText>
                        </ThemedView>
                        {isSold && (
                          <ThemedView style={styles.soldOverlay}>
                            <ThemedText style={styles.soldText}>
                              SOLD
                            </ThemedText>
                          </ThemedView>
                        )}
                      </>
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
                        setReportTarget(item.id);
                        setReportVisible(true);
                      }}
                      style={styles.reportOverlay}
                    >
                      <ThemedText style={styles.reportOverlayText}>
                        ...
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                  <ThemedView style={styles.info}>
                    <ThemedText numberOfLines={1} style={styles.cardTitle}>
                      {item.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {item.category}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.row}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
          />
        )}

        <ReportModal
          visible={reportVisible}
          contentId={reportTarget ?? ""}
          contentType="listing"
          onClose={() => {
            setReportVisible(false);
            setReportTarget(null);
          }}
        />
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
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "#121214",
  },
  filterChipActive: {
    backgroundColor: "#6C47FF",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  list: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    maxWidth: "48%",
    backgroundColor: "#121214",
  },
  imageWrapper: {
    position: "relative",
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
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#6C47FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  soldText: {
    color: "#ffffff",
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  info: {
    padding: 10,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  reportOverlay: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.error,
  },
});
