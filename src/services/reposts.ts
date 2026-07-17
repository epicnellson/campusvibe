import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";

export async function repostPost(postId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("reposts").insert({
      user_id: user.id,
      post_id: postId,
    });
    if (error) throw error;
  });
}

export async function unrepostPost(postId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("reposts")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) throw error;
  });
}

export async function getRepostCount(postId: string): Promise<number> {
  const { count } = await supabase
    .from("reposts")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  return count ?? 0;
}

export async function getUserRepostedPostIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("reposts")
    .select("post_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.post_id));
}
