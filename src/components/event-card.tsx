import { memo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { resolveImageUrl } from "@/services/storage";
import type { EventWithRSVPs } from "@/services/database.types";

export type EventCardProps = {
  event: EventWithRSVPs;
};

function formatDateTag(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function EventCardInner({ event }: EventCardProps) {
  const [imageError, setImageError] = useState(false);
  const rsvpCount = event.event_rsvps?.length ?? 0;

  const resolvedImage = !imageError && event.image_url
    ? resolveImageUrl(event.image_url, "event-images")
    : null;

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}` as any)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityLabel={`Event: ${event.title}`}
      accessibilityRole="button"
    >
      <View style={styles.contentRow}>
        <View style={styles.leftColumn}>
          <View style={styles.calendarIconContainer}>
            <Ionicons name="calendar-outline" size={20} color="#A78BFA" />
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.headerRow}>
            <View style={styles.dateTag}>
              <ThemedText style={styles.dateTagText}>
                {formatDateTag(event.date)}
              </ThemedText>
            </View>
            <ThemedText style={styles.title} numberOfLines={1}>
              {event.title}
            </ThemedText>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color="#71717A" />
            <ThemedText style={styles.metaText} numberOfLines={1}>
              {event.location}
            </ThemedText>
            {event.time && (
              <>
                <ThemedText style={styles.dot}>·</ThemedText>
                <Ionicons name="time-outline" size={14} color="#71717A" />
                <ThemedText style={styles.metaText}>
                  {event.time.slice(0, 5)}
                </ThemedText>
              </>
            )}
          </View>

          {event.description ? (
            <ThemedText style={styles.description} numberOfLines={2}>
              {event.description}
            </ThemedText>
          ) : null}

          {resolvedImage ? (
            <Image
              source={{ uri: resolvedImage }}
              style={styles.eventImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : null}

          <View style={styles.actionRow}>
            <Ionicons name="people-outline" size={16} color="#6C47FF" />
            <ThemedText style={styles.rsvpCount}>
              {rsvpCount} {rsvpCount === 1 ? "person going" : "people going"}
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const EventCard = memo(EventCardInner);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
    backgroundColor: "#09090B",
  },
  contentRow: {
    flexDirection: "row",
  },
  leftColumn: {
    marginRight: 12,
    marginTop: 2,
    width: 40,
    alignItems: "center",
  },
  rightColumn: {
    flex: 1,
  },
  calendarIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    gap: 8,
  },
  dateTag: {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTagText: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#71717A",
  },
  dot: {
    fontSize: 13,
    color: "#3A3A3C",
    marginHorizontal: 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: "#E1E1E1",
    marginTop: 2,
  },
  eventImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#0A0A0C",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  rsvpCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C47FF",
  },
  pressed: {
    opacity: 0.75,
  },
});
