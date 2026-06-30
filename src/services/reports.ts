import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";

export const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Misinformation",
  "Other",
] as const;

export async function submitReport(
  contentId: string,
  contentType: "post" | "confession" | "listing",
  reason: string
): Promise<void> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("reports").insert({
      content_id: contentId,
      content_type: contentType,
      reason,
      reporter_id: user.id,
    });
    if (error) throw error;
  });
}
