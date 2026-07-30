import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { createNotification } from "@/services/in-app-notifications";
import { notifyComment } from "@/services/notifications";
import type { CommentWithProfile } from "@/services/database.types";

export async function fetchComments(postId: string): Promise<CommentWithProfile[]> {
  return withRetry(async () => {
    const raw = await db_ops.query("comments", {
      conditions: [{ field: "post_id", op: "==", value: postId }],
      orderBy: [{ field: "created_at", direction: "asc" }],
    });

    const profileIds = [...new Set(raw.map((c) => c.user_id))];
    const profiles = await Promise.all(
      profileIds.map((id) => db_ops.get("profiles", id))
    );
    const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p]));

    return raw.map((c) => ({
      ...c,
      profiles: profileMap.get(c.user_id) ?? null,
    })) as CommentWithProfile[];
  });
}

export async function fetchCommentCounts(postIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;

  for (const postId of postIds) {
    const data = await db_ops.query("comments", {
      conditions: [{ field: "post_id", op: "==", value: postId }],
    });
    if (data.length > 0) map.set(postId, data.length);
  }
  return map;
}

export async function createComment(
  postId: string,
  content: string
): Promise<{ id: string } | null> {
  return withRetry(async () => {
    const user = getCurrentUser();
    const commentId = await db_ops.add("comments", {
      post_id: postId,
      user_id: user.uid,
      content: sanitizeText(content),
    });

    const post = await db_ops.get("posts", postId);
    if (post && post.user_id !== user.uid) {
      createNotification(post.user_id, user.uid, "comment", "post", postId);
      const sender = await db_ops.get("profiles", user.uid);
      notifyComment(post.user_id, sender?.name ?? "Someone", postId).catch(() => {});
    }

    return { id: commentId };
  });
}
