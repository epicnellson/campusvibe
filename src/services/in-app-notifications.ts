import { db_ops } from "@/services/db";
import { auth, db } from "@/services/firebase";
import { collection, query, where, orderBy, limit as fbLimit, getDocs, updateDoc, doc } from "firebase/firestore";

export type InAppNotification = {
  id: string;
  user_id: string;
  actor_id: string;
  type: "like" | "repost" | "follow" | "comment";
  content_type: "post" | "confession" | "event" | "profile";
  content_id: string;
  read: boolean;
  created_at: string;
  actor?: { name: string; avatar_url: string | null };
};

function actorMessage(type: InAppNotification["type"]): string {
  switch (type) {
    case "like": return "liked your post";
    case "repost": return "reposted your post";
    case "follow": return "started following you";
    case "comment": return "commented on your post";
  }
}

function contentIcon(type: InAppNotification["type"]): string {
  switch (type) {
    case "like": return "heart";
    case "repost": return "repeat";
    case "follow": return "person-add";
    case "comment": return "chatbubble";
  }
}

export { actorMessage, contentIcon };

export async function fetchNotifications(limit = 30): Promise<InAppNotification[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const raw = await db_ops.query("in_app_notifications", {
    conditions: [{ field: "user_id", op: "==", value: user.uid }],
    orderBy: [{ field: "created_at", direction: "desc" }],
    limitCount: limit,
  });

  const actorIds = [...new Set(raw.map((n) => n.actor_id).filter(Boolean))];
  const profiles = await Promise.all(actorIds.map((id) => db_ops.get("profiles", id)));
  const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p]));

  return raw.map((n) => ({
    ...n,
    actor: profileMap.get(n.actor_id)
      ? { name: profileMap.get(n.actor_id)!.name, avatar_url: profileMap.get(n.actor_id)!.avatar_url }
      : undefined,
  })) as InAppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;

  const all = await db_ops.query("in_app_notifications", {
    conditions: [
      { field: "user_id", op: "==", value: user.uid },
      { field: "read", op: "==", value: false },
    ],
  });
  return all.length;
}

export async function markAllRead(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const unread = await db_ops.query("in_app_notifications", {
    conditions: [
      { field: "user_id", op: "==", value: user.uid },
      { field: "read", op: "==", value: false },
    ],
  });

  for (const n of unread) {
    await db_ops.update("in_app_notifications", n.id, { read: true });
  }
}

export async function createNotification(
  recipientId: string,
  actorId: string,
  type: InAppNotification["type"],
  contentType: InAppNotification["content_type"],
  contentId: string
): Promise<void> {
  if (recipientId === actorId) return;

  try {
    await db_ops.add("in_app_notifications", {
      user_id: recipientId,
      actor_id: actorId,
      type,
      content_type: contentType,
      content_id: contentId,
      read: false,
    });
  } catch (err) {
    console.warn("[createNotification] failed:", err);
  }
}
