import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { notifyNewEvent } from "@/services/notifications";
import type { EventWithRSVPs } from "@/services/database.types";

export async function fetchUpcomingEvents(): Promise<EventWithRSVPs[]> {
  return withRetry(async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, date, time, location, image_url, created_at, user_id, event_rsvps(id, user_id)")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) throw error;
    const events = (data ?? []) as any[];
    const userIds = [...new Set(events.map((e: any) => e.user_id).filter(Boolean))];
    const profileMap = await fetchCreatorNames(userIds);
    return events.map((e: any) => ({
      ...e,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        title: sanitizeText(data.title),
        description: sanitizeText(data.description),
        date: data.date,
        time: data.time,
        location: sanitizeText(data.location),
        image_url: data.image_url ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "42501" || error.message?.includes("permission denied")) {
        throw new Error("You need a verified student ID to create events. Please upload your student ID first.");
      }
      throw error;
    }

    notifyNewEvent(data.title, event.id);
    return event.id;
  });
}

export async function rsvpEvent(eventId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("event_rsvps").insert({
      event_id: eventId,
      user_id: user.id,
    });
    if (error) throw error;
  });
}

export async function unrsvpEvent(eventId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);
    if (error) throw error;
  });
}

async function fetchCreatorNames(userIds: string[]): Promise<Map<string, { name: string }>> {
  const map = new Map<string, { name: string }>();
  if (userIds.length === 0) return map;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds);
  for (const p of profiles ?? []) {
    map.set(p.id, { name: p.name });
  }
  return map;
}
