import { Image } from "expo-image";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import { rsvpEvent, unrsvpEvent } from "@/services/events";
import type { EventWithRSVPs } from "@/services/database.types";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export type EventCardProps = {
  event: EventWithRSVPs;
  onRSVPToggled?: (eventId: string, rsvped: boolean) => void;
};

function EventCardInner({ event, onRSVPToggled }: EventCardProps) {
  const { session } = useSession();
  const theme = useTheme();
  const currentUserId = session?.user?.id;
  const userRSVPed =
    event.event_rsvps?.some((r) => r.user_id === currentUserId) ?? false;
  const rsvpCount = event.event_rsvps?.length ?? 0;

  const handleRSVP = useCallback(async () => {
    try {
      if (userRSVPed) {
        await unrsvpEvent(event.id);
      } else {
        await rsvpEvent(event.id);
      }
      onRSVPToggled?.(event.id, !userRSVPed);
    } catch {}
  }, [event.id, userRSVPed, onRSVPToggled]);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.title}>{event.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Hosted by {event.creator?.name ?? "Unknown"}
        </ThemedText>
      </ThemedView>

      {event.image_url && (
        <Image
          source={{ uri: event.image_url }}
          style={styles.image}
          contentFit="cover"
          placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
        />
      )}

      <ThemedText style={styles.description}>{event.description}</ThemedText>

      <ThemedView style={styles.details}>
        <ThemedView style={styles.detailRow}>
          <ThemedText style={styles.detailIcon}>📅</ThemedText>
          <ThemedText>{formatDate(event.date)}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.detailRow}>
          <ThemedText style={styles.detailIcon}>🕐</ThemedText>
          <ThemedText>{event.time}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.detailRow}>
          <ThemedText style={styles.detailIcon}>📍</ThemedText>
          <ThemedText>{event.location}</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.actions}>
        <Pressable
          onPress={handleRSVP}
          style={({ pressed }) => [
            styles.rsvpButton,
            userRSVPed && styles.rsvped,
            pressed && styles.pressed,
          ]}
          accessibilityLabel={userRSVPed ? `Cancel RSVP for ${event.title}` : `RSVP for ${event.title}`}
          accessibilityRole="button"
          accessibilityState={{ selected: userRSVPed }}
        >
          <ThemedText
            style={[styles.rsvpText, userRSVPed && styles.rsvpedText]}
          >
            {userRSVPed ? "✓ Going" : "RSVP"}
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          {rsvpCount} going
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

export const EventCard = memo(EventCardInner);

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: borderRadius.md,
  },
  description: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  details: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailIcon: {
    fontSize: 16,
    width: 24,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  rsvpButton: {
    paddingVertical: spacing.sm + 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "transparent",
    minHeight: 44,
    justifyContent: "center",
  },
  rsvped: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rsvpText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  rsvpedText: {
    color: "#ffffff",
  },
  pressed: {
    opacity: 0.7,
  },
});
