import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";

export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type Reaction = {
  id: string;
  user_id: string;
  post_id: string;
  emoji: string;
  created_at: string;
};

export async function setReaction(postId: string, emoji: ReactionEmoji) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("reactions")
      .upsert(
        { user_id: user.id, post_id: postId, emoji },
        { onConflict: "user_id,post_id" }
      );
    if (error) throw error;
  });
}

export async function removeReaction(postId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) throw error;
  });
}

export async function fetchReactions(postId: string): Promise<Reaction[]> {
  const { data } = await supabase
    .from("reactions")
    .select("id, user_id, post_id, emoji, created_at")
    .eq("post_id", postId);
  return (data ?? []) as Reaction[];
}

export async function fetchReactionsForPosts(postIds: string[]): Promise<Map<string, Reaction[]>> {
  if (postIds.length === 0) return new Map();
  const { data } = await supabase
    .from("reactions")
    .select("id, user_id, post_id, emoji, created_at")
    .in("post_id", postIds);
  const map = new Map<string, Reaction[]>();
  for (const r of data ?? []) {
    const existing = map.get(r.post_id) ?? [];
    existing.push(r as Reaction);
    map.set(r.post_id, existing);
  }
  return map;
}
