import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { checkModeration } from "@/services/moderation";
import { notifyPopularConfession } from "@/services/notifications";
import type { ConfessionWithLikes } from "@/services/database.types";

export async function fetchConfessions(): Promise<ConfessionWithLikes[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("confessions")
      .select(
        `
      id,
      content,
      image_url,
      created_at,
      updated_at,
      user_id,
      confession_likes(id, user_id)
    `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as ConfessionWithLikes[];
  });
}

export async function fetchConfessionById(confessionId: string): Promise<ConfessionWithLikes> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("confessions")
      .select(
        `id, content, image_url, created_at, updated_at, user_id, confession_likes(id, user_id)`
      )
      .eq("id", confessionId)
      .single();
    if (error) throw error;
    return data as unknown as ConfessionWithLikes;
  });
}

export async function createConfession(content: string, imageUrl?: string): Promise<void> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { flagged, categories } = await checkModeration(content);
    if (flagged) {
      const reason = categories.join(", ");
      throw new Error(
        `Your confession was flagged for: ${reason}. Please revise your content.`
      );
    }

    const { error } = await supabase.from("confessions").insert({
      user_id: user.id,
      content: sanitizeText(content),
      image_url: imageUrl || null,
    });
    if (error) throw error;
  });
}

export async function likeConfession(confessionId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("confession_likes").insert({
      confession_id: confessionId,
      user_id: user.id,
    });
    if (error) throw error;

    // Check if confession just hit 10+ likes
    const { count } = await supabase
      .from("confession_likes")
      .select("id", { count: "exact", head: true })
      .eq("confession_id", confessionId);

    if (count && count >= 10 && count < 15) {
      const { data: confession } = await supabase
        .from("confessions")
        .select("user_id")
        .eq("id", confessionId)
        .single();

      if (confession) {
        notifyPopularConfession(confession.user_id, count);
      }
    }
  });
}

export async function deleteConfession(confessionId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("confessions")
      .delete()
      .eq("id", confessionId);
    if (error) throw error;
  });
}

export async function unlikeConfession(confessionId: string) {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("confession_likes")
      .delete()
      .eq("confession_id", confessionId)
      .eq("user_id", user.id);
    if (error) throw error;
  });
}
