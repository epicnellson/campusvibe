import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import type { Profile } from "@/services/database.types";

export async function fetchSuggestedUsers(
  userId: string,
  department?: string,
  limit: number = 3
): Promise<Pick<Profile, "id" | "name" | "department" | "avatar_url">[]> {
  return withRetry(async () => {
    let query = supabase
      .from("profiles")
      .select("id, name, department, avatar_url")
      .neq("id", userId)
      .limit(limit);

    if (department) {
      const { data, error } = await query
        .eq("department", department)
        .limit(limit);

      if (error) throw error;
      // If we got enough from same department, return them
      if (data && data.length >= limit) return data;

      // Otherwise fill with random users
      const existingIds = (data ?? []).map((u) => u.id);
      const remaining = limit - existingIds.length;

      // We need to also check if we could not get the matching users at all
      // Let's just try a simpler approach
      const remainingCount = remaining > 0 ? remaining : 0;
      if (remainingCount > 0) {
        const { data: random, error: randomError } = await supabase
          .from("profiles")
          .select("id, name, department, avatar_url")
          .neq("id", userId)
          .not("id", "in", existingIds.length > 0 ? `(${existingIds.join(",")})` : "(00000000-0000-0000-0000-000000000000)")
          .limit(remainingCount);

        if (randomError) throw randomError;
        return [...(data ?? []), ...(random ?? [])];
      }

      return data ?? [];
    }

    // No department - just get random users
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

export async function followUser(followingId: string): Promise<void> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: followingId,
    });

    if (error) throw error;
  });
}

export async function unfollowUser(followingId: string): Promise<void> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);

    if (error) throw error;
  });
}
