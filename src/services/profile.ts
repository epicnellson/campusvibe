import { db_ops } from "@/services/db";
import { getCurrentUser, auth } from "@/services/firebase";
import { sanitizeText } from "@/services/sanitize";
import type { Profile, PostWithProfile } from "@/services/database.types";

export type ProfileData = {
  name: string;
  department: string;
  year: string;
};

export async function createProfile(data: ProfileData): Promise<Profile> {
  const user = getCurrentUser();
  if (!user.email) throw new Error("Not authenticated");

  const email_domain = user.email.split("@")[1]?.toLowerCase() ?? "";

  const profileData = {
    id: user.uid,
    email: user.email,
    email_domain,
    name: sanitizeText(data.name),
    department: sanitizeText(data.department),
    year: sanitizeText(data.year),
  };

  await db_ops.set("profiles", user.uid, profileData);
  return profileData as unknown as Profile;
}

export async function getProfile(): Promise<Profile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return (await db_ops.get("profiles", user.uid)) as unknown as Profile | null;
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  return (await db_ops.get("profiles", userId)) as unknown as Profile | null;
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

  await db_ops.update("profiles", userId, sanitized);
}

export async function fetchUserPosts(userId: string): Promise<PostWithProfile[]> {
  const posts = await db_ops.query("posts", {
    conditions: [{ field: "user_id", op: "==", value: userId }],
    orderBy: [{ field: "created_at", direction: "desc" }],
  });

  const uids = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
  const profileMap = new Map<string, { name: string; department: string }>();
  if (uids.length > 0) {
    const profiles = await Promise.all(uids.map((id) => db_ops.get("profiles", id)));
    for (const p of profiles.filter(Boolean)) {
      profileMap.set(p!.id, { name: p!.name, department: p!.department ?? "" });
    }
  }

  return posts.map((p) => ({
    ...p,
    likes: (p.likes ?? []).map((uid: string) => ({ user_id: uid })),
    profiles: profileMap.get(p.user_id) ?? null,
  })) as unknown as PostWithProfile[];
}
