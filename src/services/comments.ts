import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import type { CommentWithProfile } from "@/services/database.types";

export async function fetchComments(postId: string): Promise<CommentWithProfile[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("id, post_id, user_id, content, created_at, profiles(name, department)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as CommentWithProfile[];
  });
}

export async function createComment(
  postId: string,
  content: string
): Promise<{ id: string } | null> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        content: sanitizeText(content),
      })
      .select("id")
      .single();

    if (error) {
      if (
        error.code === "42501" ||
        error.message?.includes("permission denied")
      ) {
        throw new Error(
          "You need a verified student ID to comment. Upload your ID in settings."
        );
      }
      throw error;
    }
    return data;
  });
}
