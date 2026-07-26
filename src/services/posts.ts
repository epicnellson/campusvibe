import { db_ops } from "@/services/db";
import { getCurrentUser, auth } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import type { PostWithProfile } from "@/services/database.types";
import { notifyPostLike } from "@/services/notifications";
import { createNotification } from "@/services/in-app-notifications";

export async function fetchPosts(): Promise<PostWithProfile[]> {
  return withRetry(async () => {
    getCurrentUser();

    const posts = await db_ops.query("posts", {
      orderBy: [{ field: "created_at", direction: "desc" }],
    });

    const userIds = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
    const profileMap = await fetchProfileNames(userIds);

    return posts.map((p) => ({
      ...p,
      likes: (p.likes ?? []).map((uid: string) => ({ user_id: uid })),
      profiles: profileMap.get(p.user_id) ?? null,
    })) as unknown as PostWithProfile[];
  });
}

export async function fetchPostById(postId: string): Promise<PostWithProfile> {
  return withRetry(async () => {
    const post = await db_ops.get("posts", postId);
    if (!post) throw new Error("Post not found");

    let profileMap = new Map<string, { name: string; department: string }>();
    if (post.user_id) {
      const profile = await db_ops.get("profiles", post.user_id);
      if (profile) {
        profileMap.set(post.user_id, {
          name: profile.name,
          department: profile.department ?? "",
        });
      }
    }

    return {
      ...post,
      likes: (post.likes ?? []).map((uid: string) => ({ user_id: uid })),
      profiles: profileMap.get(post.user_id) ?? null,
    } as unknown as PostWithProfile;
  });
}

export async function createPost(content: string, imageUrl?: string): Promise<void> {
  return withRetry(async () => {
    const user = getCurrentUser();
    await db_ops.add("posts", {
      user_id: user.uid,
      content: sanitizeText(content),
      image_url: imageUrl || null,
      likes: [],
    });
  });
}

export async function likePost(postId: string) {
  const user = getCurrentUser();

  const post = await db_ops.get("posts", postId);
  if (!post) throw new Error("Post not found");

  const currentLikes: string[] = post.likes ?? [];
  if (currentLikes.includes(user.uid)) return;

  await db_ops.addToArray("posts", postId, "likes", user.uid);

  if (post.user_id !== user.uid) {
    const profile = await db_ops.get("profiles", user.uid);
    notifyPostLike(post.user_id, profile?.name ?? "Someone", postId);
    createNotification(post.user_id, user.uid, "like", "post", postId);
  }
}

export async function unlikePost(postId: string) {
  const user = getCurrentUser();
  await db_ops.removeFromArray("posts", postId, "likes", user.uid);
}

export async function deletePost(postId: string) {
  getCurrentUser();
  await db_ops.delete("posts", postId);
}

async function fetchProfileNames(userIds: string[]): Promise<Map<string, { name: string; department: string }>> {
  const map = new Map<string, { name: string; department: string }>();
  if (userIds.length === 0) return map;

  const profiles = await Promise.all(userIds.map((id) => db_ops.get("profiles", id)));
  for (const p of profiles.filter(Boolean)) {
    map.set(p!.id, { name: p!.name, department: p!.department ?? "" });
  }
  return map;
}
