import { supabase } from "@/services/supabase";
import { sanitizeText } from "@/services/sanitize";
import type { Profile, PostWithProfile } from "@/services/database.types";

export type ProfileData = {
  name: string;
  department: string;
  year: string;
};

export async function createProfile(data: ProfileData): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Not authenticated");

  const email_domain = user.email.split("@")[1]?.toLowerCase() ?? "";

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      email_domain,
      name: sanitizeText(data.name),
      department: sanitizeText(data.department),
      year: sanitizeText(data.year),
    })
    .select()
    .single();

  if (error) throw error;
  return profile;
}

export async function getProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "name" | "department" | "year" | "avatar_url">>
): Promise<void> {
  const sanitized: Record<string, any> = {};
  if (updates.name !== undefined) sanitized.name = sanitizeText(updates.name);
  if (updates.department !== undefined) sanitized.department = sanitizeText(updates.department);
  if (updates.year !== undefined) sanitized.year = sanitizeText(updates.year);
  if (updates.avatar_url !== undefined) sanitized.avatar_url = updates.avatar_url;

  const { error } = await supabase
    .from("profiles")
    .update(sanitized)
    .eq("id", userId);

  if (error) throw error;
}

export async function fetchUserPosts(userId: string): Promise<PostWithProfile[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, created_at, updated_at, user_id, likes(id, user_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const posts = (data ?? []) as any[];
  const uids = [...new Set(posts.map((p: any) => p.user_id).filter(Boolean))];
  const profileMap = new Map<string, { name: string; department: string }>();
  if (uids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, department")
      .in("id", uids);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { name: p.name, department: p.department ?? "" });
    }
  }
  return posts.map((p: any) => ({
    ...p,
    profiles: profileMap.get(p.user_id) ?? null,
  })) as unknown as PostWithProfile[];
}
