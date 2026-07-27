import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { resolveImageUrl } from "@/services/storage";
import type { EventWithRSVPs } from "@/services/database.types";
import { eventDateTag } from "@/utils/date";

export type EventCardProps = {
  event: EventWithRSVPs;
};

function EventCardInner({ event }: EventCardProps) {
  const [imageError, setImageError] = useState(false);
  const colors = useTheme();
  const rsvpCount = event.event_rsvps?.length ?? 0;

  const resolvedImage = !imageError && event.image_url
    ? resolveImageUrl(event.image_url, "event-images")
    : null;

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}` as any)}
      style={({ pressed }) => [styles.container, { borderBottomColor: colors.divider, backgroundColor: colors.backgroundSecondary }, pressed && styles.pressed]}
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
                {eventDateTag(event.date)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {event.title}
            </ThemedText>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.muted} />
            <ThemedText style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
              {event.location}
            </ThemedText>
            {event.time && (
              <>
                <ThemedText style={[styles.dot, { color: colors.inputBorder }]}>·</ThemedText>
                <Ionicons name="time-outline" size={14} color={colors.muted} />
                <ThemedText style={[styles.metaText, { color: colors.muted }]}>
                  {event.time.slice(0, 5)}
                </ThemedText>
              </>
            )}
          </View>

          {event.description ? (
            <ThemedText style={[styles.description, { color: colors.textBody }]} numberOfLines={2}>
              {event.description}
            </ThemedText>
          ) : null}

          {resolvedImage ? (
            <Image
              source={resolvedImage}
              style={[styles.eventImage, { backgroundColor: colors.background }]}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={300}
              placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
              onError={() => setImageError(true)}
            />
          ) : null}

          <View style={styles.actionRow}>
            <Ionicons name="people-outline" size={16} color={colors.primary} />
            <ThemedText style={[styles.rsvpCount, { color: colors.primary }]}>
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
  },
  dot: {
    fontSize: 13,
    marginHorizontal: 2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  eventImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 14,
    marginTop: 10,
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
  },
  pressed: {
    opacity: 0.75,
  },
});
