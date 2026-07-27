import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ReportModal } from "@/components/report-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarketplaceListSkeleton } from "@/components/feed-skeleton";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { fetchListings } from "@/services/marketplace";
import type { ListingWithSeller } from "@/services/database.types";
import { timeAgo } from "@/utils/date";

const CATEGORIES = [
  { label: "All", icon: "grid" as const },
  { label: "Textbooks", icon: "book" as const },
  { label: "Electronics", icon: "laptop" as const },
  { label: "Clothing", icon: "shirt" as const },
  { label: "Furniture", icon: "bed" as const },
  { label: "Tickets", icon: "ticket" as const },
  { label: "Other", icon: "ellipsis-horizontal" as const },
] as const;
const SORT_OPTIONS = ["Newest", "Price ↑", "Price ↓"] as const;

function formatPrice(price: string): string {
  return price.startsWith("$") ? price : `$${price}`;
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
    paddingBottom: 12,
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
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sortRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sortChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  sortChipActive: {
    backgroundColor: "#6C47FF",
    borderColor: "#6C47FF",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  sortChipTextActive: {
    color: "#ffffff",
  },
  filterScroll: {
    maxHeight: 60,
    marginBottom: 4,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    minHeight: 40,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: "#6C47FF",
    borderColor: "#6C47FF",
  },
  filterChipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#A1A1AA",
    lineHeight: 20,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  filterChipIcon: {
    marginRight: -2,
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
    gap: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardCategory: {
    fontSize: 12,
    color: "#71717A",
  },
  cardTime: {
    fontSize: 11,
    color: "#555555",
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
  countText: {
    fontSize: 13,
    color: "#71717A",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

export default function MarketplaceScreen() {
  const colors = useTheme();
  const { profile } = useProfile();
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("Newest");
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

  let filtered =
    selectedCategory === "All"
      ? listings
      : listings.filter((l) => l.category === selectedCategory);

  if (sortBy === "Price ↑") {
    filtered = [...filtered].sort((a, b) => {
      const pa = parseFloat(a.price?.replace(/[^0-9.]/g, "") || "0");
      const pb = parseFloat(b.price?.replace(/[^0-9.]/g, "") || "0");
      return pa - pb;
    });
  } else if (sortBy === "Price ↓") {
    filtered = [...filtered].sort((a, b) => {
      const pa = parseFloat(a.price?.replace(/[^0-9.]/g, "") || "0");
      const pb = parseFloat(b.price?.replace(/[^0-9.]/g, "") || "0");
      return pb - pa;
    });
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <MarketplaceListSkeleton />
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
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Create Listing"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={24} color={colors.textOnDark} />
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
              key={cat.label}
              onPress={() => setSelectedCategory(cat.label)}
              style={[
                styles.filterChip,
                selectedCategory === cat.label && styles.filterChipActive,
              ]}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={selectedCategory === cat.label ? "#FFFFFF" : "#A1A1AA"}
                style={styles.filterChipIcon}
              />
              <ThemedText
                style={[
                  styles.filterChipText,
                  selectedCategory === cat.label && styles.filterChipTextActive,
                ]}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setSortBy(opt)}
              style={[
                styles.sortChip,
                sortBy === opt && styles.sortChipActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.sortChipText,
                  sortBy === opt && styles.sortChipTextActive,
                ]}
              >
                {opt}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.countText}>
          {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
        </ThemedText>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : filtered.length === 0 ? (
          <ThemedView style={styles.center}>
            <Ionicons name="storefront-outline" size={48} color="#2A2A2A" />
            <ThemedText themeColor="textSecondary" style={{ marginTop: 12 }}>
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
            key={`grid-${numColumns}-${selectedCategory}-${sortBy}`}
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
                            <ThemedText style={styles.soldText}>SOLD</ThemedText>
                          </ThemedView>
                        )}
                      </>
                    ) : (
                      <ThemedView style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#3A3A3A" />
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
                      <ThemedText style={styles.reportOverlayText}>...</ThemedText>
                    </Pressable>
                  </ThemedView>
                  <ThemedView style={styles.info}>
                    <ThemedText numberOfLines={1} style={styles.cardTitle}>
                      {item.title}
                    </ThemedText>
                    <View style={styles.cardMeta}>
                      <ThemedText type="small" style={styles.cardCategory} numberOfLines={1}>
                        {item.category}
                      </ThemedText>
                      {item.created_at && (
                        <ThemedText style={styles.cardTime}>
                          {timeAgo(item.created_at)}
                        </ThemedText>
                      )}
                    </View>
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
