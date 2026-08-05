import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { checkModeration } from "@/services/moderation";
import { notifyPopularConfession } from "@/services/notifications";
import { createNotification } from "@/services/in-app-notifications";
import type { ConfessionWithLikes } from "@/services/database.types";

export async function fetchConfessions(): Promise<ConfessionWithLikes[]> {
  return withRetry(async () => {
    const confessions = await db_ops.query("confessions", {
      orderBy: [{ field: "created_at", direction: "desc" }],
    });

    return confessions.map((c) => ({
      ...c,
      confession_likes: (c.likes ?? []).map((uid: string) => ({ user_id: uid })),
    })) as unknown as ConfessionWithLikes[];
  });
}

export async function fetchConfessionById(confessionId: string): Promise<ConfessionWithLikes> {
  return withRetry(async () => {
    const c = await db_ops.get("confessions", confessionId);
    if (!c) throw new Error("Confession not found");
    return {
      ...c,
      confession_likes: (c.likes ?? []).map((uid: string) => ({ user_id: uid })),
    } as unknown as ConfessionWithLikes;
  });
}

export async function createConfession(content: string, imageUrl?: string): Promise<void> {
  return withRetry(async () => {
    const user = getCurrentUser();

    if (!content || !content.trim()) {
      throw new Error("Please write something before posting.");
    }

    const { flagged, categories } = await checkModeration(content);
    if (flagged) {
      const reason = categories.join(", ");
      throw new Error(
        `Your confession was flagged for: ${reason}. Please revise your content.`
      );
    }

    await db_ops.add("confessions", {
      user_id: user.uid,
      content: sanitizeText(content),
      image_url: imageUrl || null,
      likes: [],
    });
  });
}

export async function likeConfession(confessionId: string) {
  const user = getCurrentUser();

  const confession = await db_ops.get("confessions", confessionId);
  if (!confession) throw new Error("Confession not found");

  const currentLikes: string[] = confession.likes ?? [];
  if (currentLikes.includes(user.uid)) return;

  await db_ops.addToArray("confessions", confessionId, "likes", user.uid);

  if (confession.user_id !== user.uid) {
    createNotification(confession.user_id, user.uid, "like", "confession", confessionId);
  }

  const newCount = currentLikes.length + 1;
  if (newCount >= 10 && newCount < 15) {
    notifyPopularConfession(confession.user_id, newCount);
  }
}

export async function deleteConfession(confessionId: string) {
  getCurrentUser();
  await db_ops.delete("confessions", confessionId);
}

export async function unlikeConfession(confessionId: string) {
  const user = getCurrentUser();
  await db_ops.removeFromArray("confessions", confessionId, "likes", user.uid);
}
