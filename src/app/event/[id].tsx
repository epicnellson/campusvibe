import { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/hooks/use-session";
import { rsvpEvent, unrsvpEvent, deleteEvent } from "@/services/events";
import { resolveImageUrl } from "@/services/storage";
import type { EventWithRSVPs } from "@/services/database.types";
import { supabase } from "@/services/supabase";

type EventDetail = EventWithRSVPs;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  const currentUserId = session?.user?.id;
  const isGoing = event?.event_rsvps?.some((r) => r.user_id === currentUserId) ?? false;
  const goingCount = event?.event_rsvps?.length ?? 0;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchErr } = await supabase
          .from("events")
          .select(
            "id, title, description, date, time, location, image_url, created_at, user_id, event_rsvps(id, user_id), creator:profiles(name)"
          )
          .eq("id", id)
          .single();
        if (fetchErr) throw fetchErr;
        if (!cancelled) setEvent(data as unknown as EventDetail);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleRsvp = useCallback(async () => {
    if (!event || !currentUserId) return;
    setRsvpLoading(true);
    try {
      if (isGoing) {
        await unrsvpEvent(event.id);
        setEvent((prev) =>
          prev
            ? { ...prev, event_rsvps: prev.event_rsvps.filter((r) => r.user_id !== currentUserId) }
            : prev
        );
      } else {
        await rsvpEvent(event.id);
        setEvent((prev) =>
          prev
            ? {
                ...prev,
                event_rsvps: [...prev.event_rsvps, { id: "optimistic", event_id: event.id, user_id: currentUserId }],
              }
            : prev
        );
      }
    } catch {}
    setRsvpLoading(false);
  }, [event, currentUserId, isGoing]);

  const handleDeleteEvent = useCallback(async () => {
    if (!event) return;
    try {
      await deleteEvent(event.id);
      router.replace("/");
    } catch {
      Alert.alert("Error", "Could not delete event. Please try again.");
    }
    setShowMenu(false);
  }, [event]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6C47FF" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color="#2A2A2A" />
        <Text style={styles.errorText}>{error ?? "Event not found"}</Text>
      </View>
    );
  }

  const bannerUri = resolveImageUrl(event.image_url, "event-images");

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.bannerContainer}>
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
              <Ionicons name="calendar-outline" size={56} color="#2A2A2A" />
            </View>
          )}
          {/* Gradient overlay at bottom of banner */}
          <View style={styles.bannerGradient} />
          {/* Back button */}
          <View style={[styles.bannerNav, { top: insets.top + 10 }]}>
            <Pressable
              onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => setShowMenu(true)}
              style={styles.backButton}
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Date badge */}
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color="#A78BFA" />
            <Text style={styles.dateBadgeText}>{formatDate(event.date)}</Text>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          {/* Info rows */}
          <View style={styles.infoBlock}>
            {event.time ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="time-outline" size={17} color="#A78BFA" />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Time</Text>
                  <Text style={styles.infoValue}>{formatTime(event.time)}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={17} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{event.location}</Text>
              </View>
            </View>
            {event.creator?.name ? (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="person-outline" size={17} color="#A78BFA" />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Hosted by</Text>
                  <Text style={styles.infoValue}>{event.creator.name}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="people-outline" size={17} color="#A78BFA" />
              </View>
              <View>
                <Text style={styles.infoLabel}>Attendees</Text>
                <Text style={styles.infoValue}>
                  {goingCount} {goingCount === 1 ? "person" : "people"} going
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* About */}
          <Text style={styles.sectionHeading}>About this event</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>
      </ScrollView>

      {/* RSVP dock */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.rsvpCountRow}>
          <Ionicons
            name={isGoing ? "checkmark-circle" : "people-outline"}
            size={16}
            color={isGoing ? "#22C55E" : "#71717A"}
          />
          <Text style={[styles.rsvpCountText, isGoing && { color: "#22C55E" }]}>
            {isGoing ? "You're going!" : `${goingCount} going`}
          </Text>
        </View>
        <Pressable
          onPress={handleRsvp}
          disabled={rsvpLoading}
          style={({ pressed }) => [
            styles.rsvpButton,
            {
              backgroundColor: isGoing ? "rgba(108, 71, 255, 0.15)" : "#6C47FF",
              borderWidth: isGoing ? 1.5 : 0,
              borderColor: "#6C47FF",
            },
            pressed && styles.pressed,
          ]}
          accessibilityLabel={isGoing ? "Cancel RSVP" : "RSVP to event"}
          accessibilityRole="button"
        >
          {rsvpLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.rsvpButtonText, isGoing && { color: "#A78BFA" }]}>
              {isGoing ? "✓ Going" : "RSVP · I'm Going"}
            </Text>
          )}
        </Pressable>
      </View>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Pressable
              onPress={() => {
                setShowMenu(false);
                Alert.alert("Delete event", "Are you sure you want to delete this event?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: handleDeleteEvent },
                ]);
              }}
              style={({ pressed }) => [styles.actionSheetItem, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionSheetLabel, { color: "#EF4444" }]}>Delete event</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMenu(false)}
              style={({ pressed }) => [styles.actionSheetCancel, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: "#71717A",
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  bannerContainer: {
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#0A0A0A",
  },
  bannerPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0A",
  },
  bannerGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
  bannerNav: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 0,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  dateBadgeText: {
    fontSize: 13,
    color: "#A78BFA",
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 32,
    marginBottom: 18,
  },
  infoBlock: {
    gap: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    color: "#71717A",
    fontWeight: "500",
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 15,
    color: "#E1E1E1",
    fontWeight: "500",
  },
  divider: {
    height: 0.5,
    backgroundColor: "#1E1E1E",
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: "#A0A0A0",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#000000",
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E1E",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rsvpCountRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rsvpCountText: {
    fontSize: 14,
    color: "#71717A",
    fontWeight: "500",
  },
  rsvpButton: {
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  rsvpButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#262626",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSheetLabel: {
    fontSize: 16,
    color: "#E1E1E1",
    fontWeight: "500",
  },
  actionSheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: "#262626",
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: "#71717A",
    fontWeight: "500",
  },
});
