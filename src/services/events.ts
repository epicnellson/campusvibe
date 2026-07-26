import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { notifyNewEvent } from "@/services/notifications";
import type { EventWithRSVPs } from "@/services/database.types";

export async function fetchUpcomingEvents(): Promise<EventWithRSVPs[]> {
  return withRetry(async () => {
    const today = new Date().toISOString().split("T")[0];

    const allEvents = await db_ops.query("events", {
      orderBy: [{ field: "date", direction: "asc" }],
    });

    const upcomingEvents = allEvents.filter((e) => e.date >= today);

    const userIds = [...new Set(upcomingEvents.map((e) => e.user_id).filter(Boolean))];
    const profileMap = await fetchCreatorNames(userIds);

    return upcomingEvents.map((e) => ({
      ...e,
      event_rsvps: (e.rsvps ?? []).map((uid: string) => ({ user_id: uid })),
      creator: profileMap.get(e.user_id) ?? null,
    })) as unknown as EventWithRSVPs[];
  });
}

export type CreateEventData = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  image_url?: string;
};

export async function createEvent(data: CreateEventData): Promise<string> {
  return withRetry(async () => {
    const user = getCurrentUser();

    const eventId = await db_ops.add("events", {
      user_id: user.uid,
      title: sanitizeText(data.title),
      description: sanitizeText(data.description),
      date: data.date,
      time: data.time,
      location: sanitizeText(data.location),
      image_url: data.image_url ?? null,
      rsvps: [],
    });

    notifyNewEvent(data.title, eventId);
    return eventId;
  });
}

export async function rsvpEvent(eventId: string) {
  return withRetry(async () => {
    const user = getCurrentUser();
    await db_ops.addToArray("events", eventId, "rsvps", user.uid);
  });
}

export async function unrsvpEvent(eventId: string) {
  return withRetry(async () => {
    const user = getCurrentUser();
    await db_ops.removeFromArray("events", eventId, "rsvps", user.uid);
  });
}

export async function deleteEvent(eventId: string) {
  return withRetry(async () => {
    getCurrentUser();
    await db_ops.delete("events", eventId);
  });
}

async function fetchCreatorNames(userIds: string[]): Promise<Map<string, { name: string }>> {
  const map = new Map<string, { name: string }>();
  if (userIds.length === 0) return map;

  const profiles = await Promise.all(userIds.map((id) => db_ops.get("profiles", id)));
  for (const p of profiles.filter(Boolean)) {
    map.set(p!.id, { name: p!.name });
  }
  return map;
}
