import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useProfile } from "@/hooks/use-profile";
import { useSession } from "@/hooks/use-session";
import { fetchUpcomingEvents, rsvpEvent, unrsvpEvent } from "@/services/events";
import { requireVerified } from "@/services/verification";
import type { EventWithRSVPs } from "@/services/database.types";

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }),
    day: date.getDate(),
    full: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  };
}

export default function EventsScreen() {
  const { session } = useSession();
  const { profile } = useProfile();
  const currentUserId = session?.user?.id;
  const [events, setEvents] = useState<EventWithRSVPs[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchUpcomingEvents();
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
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

  const ITEM_HEIGHT = 140;

  const handleRSVPToggled = useCallback((eventId: string, rsvped: boolean) => {
    if (!currentUserId) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        const updatedRSVPs = rsvped
          ? [...(e.event_rsvps ?? []), { id: "", user_id: currentUserId! }]
          : (e.event_rsvps ?? []).filter((r) => r.user_id !== currentUserId);
        return { ...e, event_rsvps: updatedRSVPs };
      })
    );
  }, [currentUserId]);

  const handleRSVP = async (event: EventWithRSVPs) => {
    const rsvped =
      event.event_rsvps?.some((r) => r.user_id === currentUserId) ?? false;
    try {
      if (rsvped) {
        await unrsvpEvent(event.id);
      } else {
        await rsvpEvent(event.id);
      }
      handleRSVPToggled(event.id, !rsvped);
    } catch {}
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading...</ThemedText>
      </ThemedView>
    );
  }

  const featured = events.slice(0, 5);

  const renderItem = ({ item }: { item: EventWithRSVPs }) => {
    const fd = formatDate(item.date);
    const rsvped =
      item.event_rsvps?.some((r) => r.user_id === currentUserId) ?? false;

    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedView style={styles.dateBadge}>
          <ThemedText style={styles.dateBadgeMonth}>{fd.month}</ThemedText>
          <ThemedText style={styles.dateBadgeDay}>{fd.day}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.cardContent}>
          <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.cardMeta}>
            {fd.full} · {item.time} · {item.location}
          </ThemedText>
          <ThemedView style={styles.rsvpRow}>
            <Pressable
              onPress={() => handleRSVP(item)}
              style={({ pressed }) => [
                styles.rsvpButton,
                rsvped && styles.rsvpButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText
                style={[styles.rsvpText, rsvped && styles.rsvpTextActive]}
              >
                {rsvped ? "Going ✓" : "RSVP"}
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              {item.event_rsvps?.length ?? 0} going
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.headerBar}>
          <ThemedText type="title" style={styles.title}>
            Events
          </ThemedText>
          <Pressable
            onPress={() => {
              if (!requireVerified(profile)) return;
              router.push("/create-event");
            }}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText style={styles.createButtonText}>+</ThemedText>
          </Pressable>
        </ThemedView>

        {error ? (
          <EmptyState
            icon="⚠"
            title="Failed to load"
            message={error}
            action={{ title: "Try again", onPress: load }}
          />
        ) : events.length === 0 ? (
          <ThemedView style={styles.center}>
            <ThemedText themeColor="textSecondary">
              No upcoming events. Create one!
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              featured.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.featuredScroll}
                  contentContainerStyle={styles.featuredContent}
                >
                  {featured.map((event) => {
                    const fd = formatDate(event.date);
                    return (
                      <Pressable key={event.id} style={styles.featuredCard}>
                        {event.image_url ? (
                          <Image
                            source={{ uri: event.image_url }}
                            style={styles.featuredImage}
                            contentFit="cover"
                          />
                        ) : (
                          <ThemedView
                            style={[
                              styles.featuredImage,
                              styles.featuredPlaceholder,
                            ]}
                          />
                        )}
                        <ThemedView style={styles.featuredOverlay}>
                          <ThemedText style={styles.featuredDate}>
                            {fd.month} {fd.day}
                          </ThemedText>
                          <ThemedText
                            style={styles.featuredTitle}
                            numberOfLines={2}
                          >
                            {event.title}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null
            }
          />
        )}
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
    paddingBottom: BottomTabInset,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 28,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: fontWeight.semibold,
    lineHeight: 26,
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
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
  featuredScroll: {
    marginBottom: spacing.md,
  },
  featuredContent: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  featuredCard: {
    width: 260,
    height: 160,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
  },
  featuredPlaceholder: {
    backgroundColor: colors.backgroundElement,
  },
  featuredOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.overlay,
  },
  featuredDate: {
    color: "#ffffff",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  featuredTitle: {
    color: "#ffffff",
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  card: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  dateBadge: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundSelected,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
  },
  dateBadgeMonth: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textTransform: "uppercase",
  },
  dateBadgeDay: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  cardContent: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  cardMeta: {
    fontSize: fontSize.sm,
  },
  rsvpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  rsvpButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    backgroundColor: "transparent",
  },
  rsvpButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  rsvpText: {
    color: colors.secondary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  rsvpTextActive: {
    color: "#ffffff",
  },
});
