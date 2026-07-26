import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
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
    const user = getCurrentUser();
    await db_ops.add("reports", {
      content_id: contentId,
      content_type: contentType,
      reason,
      reporter_id: user.uid,
      status: "pending",
    });
  });
}
