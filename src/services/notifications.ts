import { supabase } from "@/services/supabase";
import type { NotificationPreferences } from "@/services/database.types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
};

async function sendExpoPush(msg: ExpoPushMessage): Promise<void> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msg),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("Expo push failed:", text);
    }
  } catch (e) {
    console.warn("Expo push error:", e);
  }
}

export async function registerPushToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("push_tokens").upsert(
    { user_id: user.id, token },
    { onConflict: "user_id" }
  );
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  return (data?.notification_preferences as NotificationPreferences) ?? null;
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const current = await getNotificationPreferences();
  const merged = { ...current, ...prefs };

  await supabase
    .from("profiles")
    .update({ notification_preferences: merged })
    .eq("id", user.id);
}

export async function notifyPostLike(
  postOwnerId: string,
  likerName: string,
  postId: string
): Promise<void> {
  if (!postOwnerId) return;

  const { data: prefs } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", postOwnerId)
    .single();

  const prefsData = prefs?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.likes) return;

  const { data: tokenData } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", postOwnerId)
    .maybeSingle();

  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "New Like",
    body: `${likerName} liked your post`,
    data: { type: "post", postId },
  });
}

export async function notifyMessage(
  recipientId: string,
  senderName: string,
  channelId: string
): Promise<void> {
  if (!recipientId) return;

  const { data: prefs } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", recipientId)
    .single();

  const prefsData = prefs?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.messages) return;

  const { data: tokenData } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", recipientId)
    .maybeSingle();

  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "New Message",
    body: `${senderName} sent you a message`,
    data: { type: "chat", channelId },
  });
}

export async function notifyNewEvent(
  eventTitle: string,
  eventId: string
): Promise<void> {
  // Get all users who have new_events enabled and have a push token
  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      `
      id,
      notification_preferences
    `
    );

  if (!profiles?.length) return;

  const eligibleUserIds = profiles
    .filter((p) => {
      const prefs = p.notification_preferences as NotificationPreferences | null;
      return prefs?.new_events !== false;
    })
    .map((p) => p.id);

  if (!eligibleUserIds.length) return;

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", eligibleUserIds);

  if (!tokens?.length) return;

  // Expo allows batching up to 100 per request
  const batchSize = 100;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize).map((t) => ({
      to: t.token,
      title: "New Event",
      body: `${eventTitle} has been posted!`,
      data: { type: "event", eventId },
      sound: "default" as const,
    }));
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
    } catch (e) {
      console.warn("Batch push failed:", e);
    }
  }
}

export async function notifyPopularConfession(
  ownerId: string,
  likeCount: number
): Promise<void> {
  if (!ownerId) return;

  const { data: prefs } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", ownerId)
    .single();

  const prefsData = prefs?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.popular_confessions) return;

  const { data: tokenData } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "Popular Confession",
    body: `Your confession reached ${likeCount} likes!`,
    data: { type: "confession" },
  });
}
