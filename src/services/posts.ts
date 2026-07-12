import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import type { PostWithProfile } from "@/services/database.types";
import { notifyPostLike } from "@/services/notifications";

export async function fetchPosts(): Promise<PostWithProfile[]> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("posts")
      .select("id, content, created_at, updated_at, user_id, likes(id, user_id)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const posts = (data ?? []) as any[];
    const userIds = [...new Set(posts.map((p: any) => p.user_id).filter(Boolean))];
    const profileMap = await fetchProfileNames(userIds);
    return posts.map((p: any) => ({
      ...p,
      profiles: profileMap.get(p.user_id) ?? null,
    })) as unknown as PostWithProfile[];
  });
}

export async function createPost(content: string, imageUrl?: string): Promise<void> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: sanitizeText(content),
      image_url: imageUrl ?? null,
    });
    if (error) {
      if (error.code === "42501" || error.message?.includes("permission denied")) {
        throw new Error("You need a verified student ID to create posts. Please upload your student ID first.");
      }
      throw error;
    }
  });
}

export async function likePost(postId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (!post) throw new Error("Post not found");

    const { error } = await supabase.from("likes").insert({
      post_id: postId,
      user_id: user.id,
    });
    if (error) throw error;

    if (post.user_id !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      notifyPostLike(post.user_id, profile?.name ?? "Someone", postId);
    }
  });
}

export async function unlikePost(postId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) throw error;
  });
}

async function fetchProfileNames(userIds: string[]): Promise<Map<string, { name: string; department: string }>> {
  const map = new Map<string, { name: string; department: string }>();
  if (userIds.length === 0) return map;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, department")
    .in("id", userIds);
  for (const p of profiles ?? []) {
    map.set(p.id, { name: p.name, department: p.department ?? "" });
  }
  return map;
}
