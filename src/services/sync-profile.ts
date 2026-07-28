import { supabase } from "@/services/supabase";

export async function syncProfileToSupabase(profile: {
  id: string;
  email: string;
  name?: string;
  department?: string;
  year?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("sync-profile", {
      body: profile,
    });
    if (error) console.warn("sync-profile error:", error);
  } catch (e) {
    console.warn("sync-profile failed:", e);
  }
}
