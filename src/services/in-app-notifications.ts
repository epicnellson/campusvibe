import { supabase } from "@/services/supabase";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("in_app_notifications")
    .select("id, user_id, actor_id, type, content_type, content_id, read, created_at, actor:profiles!in_app_notifications_actor_id_fkey(name, avatar_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as InAppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("in_app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return count ?? 0;
}

export async function markAllRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("in_app_notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
}

export async function createNotification(
  recipientId: string,
  actorId: string,
  type: InAppNotification["type"],
  contentType: InAppNotification["content_type"],
  contentId: string
): Promise<void> {
  if (recipientId === actorId) return;

  const { error } = await supabase.from("in_app_notifications").insert({
    user_id: recipientId,
    actor_id: actorId,
    type,
    content_type: contentType,
    content_id: contentId,
  });

  if (error) {
    console.warn("[createNotification] failed:", error);
  }
}
