import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { createNotification } from "@/services/in-app-notifications";
import { notifyRepost } from "@/services/notifications";

export async function repostPost(postId: string) {
  const user = getCurrentUser();

  const existingReposts = await db_ops.query("reposts", {
    conditions: [
      { field: "post_id", op: "==", value: postId },
      { field: "user_id", op: "==", value: user.uid },
    ],
  });
  if (existingReposts.length > 0) return;

  const post = await db_ops.get("posts", postId);

  const repostId = `${user.uid}_${postId}`;
  await db_ops.set("reposts", repostId, {
    user_id: user.uid,
    post_id: postId,
  });

  if (post && post.user_id !== user.uid) {
    createNotification(post.user_id, user.uid, "repost", "post", postId);
    const sender = await db_ops.get("profiles", user.uid);
    notifyRepost(post.user_id, sender?.name ?? "Someone", postId).catch(() => {});
  }
}

export async function unrepostPost(postId: string) {
  const user = getCurrentUser();
  const repostId = `${user.uid}_${postId}`;
  await db_ops.delete("reposts", repostId);
}

export async function getRepostCount(postId: string): Promise<number> {
  const data = await db_ops.query("reposts", {
    conditions: [{ field: "post_id", op: "==", value: postId }],
  });
  return data.length;
}

export async function getUserRepostedPostIds(userId: string): Promise<Set<string>> {
  const data = await db_ops.query("reposts", {
    conditions: [{ field: "user_id", op: "==", value: userId }],
  });
  return new Set(data.map((r) => r.post_id));
}
