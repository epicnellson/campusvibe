import { db_ops } from "@/services/db";
import { auth } from "@/services/firebase";
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
      headers: { "Content-Type": "application/json" },
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
  const user = auth.currentUser;
  if (!user) return;
  await db_ops.set("push_tokens", user.uid, { user_id: user.uid, token });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const profile = await db_ops.get("profiles", user.uid);
  return (profile?.notification_preferences as NotificationPreferences) ?? null;
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const current = await getNotificationPreferences();
  const merged = { ...current, ...prefs };
  await db_ops.update("profiles", user.uid, { notification_preferences: merged });
}

export async function notifyPostLike(
  postOwnerId: string,
  likerName: string,
  postId: string
): Promise<void> {
  if (!postOwnerId) return;
  const profile = await db_ops.get("profiles", postOwnerId);
  const prefsData = profile?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.likes) return;

  const tokenData = await db_ops.get("push_tokens", postOwnerId);
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
  const profile = await db_ops.get("profiles", recipientId);
  const prefsData = profile?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.messages) return;

  const tokenData = await db_ops.get("push_tokens", recipientId);
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
  const profiles = await db_ops.query("profiles");

  const eligibleUserIds = profiles
    .filter((p) => {
      const prefs = p.notification_preferences as NotificationPreferences | null;
      return prefs?.new_events !== false;
    })
    .map((p) => p.id);

  if (!eligibleUserIds.length) return;

  const tokens = await Promise.all(
    eligibleUserIds.map((id) => db_ops.get("push_tokens", id))
  );

  const validTokens = tokens.filter(Boolean).map((t) => t!.token);
  if (!validTokens.length) return;

  const batchSize = 100;
  for (let i = 0; i < validTokens.length; i += batchSize) {
    const batch = validTokens.slice(i, i + batchSize).map((t) => ({
      to: t,
      title: "New Event",
      body: `${eventTitle} has been posted!`,
      data: { type: "event", eventId },
      sound: "default" as const,
    }));
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
    } catch (e) {
      console.warn("Batch push failed:", e);
    }
  }
}

export async function notifyFollow(
  targetUserId: string,
  followerName: string,
  followerId: string
): Promise<void> {
  if (!targetUserId) return;
  const profile = await db_ops.get("profiles", targetUserId);
  const prefsData = profile?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.follows) return;

  const tokenData = await db_ops.get("push_tokens", targetUserId);
  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "New Follower",
    body: `${followerName} started following you`,
    data: { type: "follow", userId: followerId },
  });
}

export async function notifyComment(
  postOwnerId: string,
  commenterName: string,
  postId: string
): Promise<void> {
  if (!postOwnerId) return;
  const profile = await db_ops.get("profiles", postOwnerId);
  const prefsData = profile?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.comments) return;

  const tokenData = await db_ops.get("push_tokens", postOwnerId);
  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "New Comment",
    body: `${commenterName} commented on your post`,
    data: { type: "comment", postId },
  });
}

export async function notifyRepost(
  postOwnerId: string,
  reposterName: string,
  postId: string
): Promise<void> {
  if (!postOwnerId) return;
  const profile = await db_ops.get("profiles", postOwnerId);
  const prefsData = profile?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.reposts) return;

  const tokenData = await db_ops.get("push_tokens", postOwnerId);
  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "New Repost",
    body: `${reposterName} reposted your post`,
    data: { type: "repost", postId },
  });
}

export async function notifyPopularConfession(
  ownerId: string,
  likeCount: number
): Promise<void> {
  if (!ownerId) return;
  const profile = await db_ops.get("profiles", ownerId);
  const prefsData = profile?.notification_preferences as NotificationPreferences | undefined;
  if (!prefsData?.popular_confessions) return;

  const tokenData = await db_ops.get("push_tokens", ownerId);
  if (!tokenData?.token) return;

  await sendExpoPush({
    to: tokenData.token,
    title: "Popular Confession",
    body: `Your confession reached ${likeCount} likes!`,
    data: { type: "confession" },
  });
}
