import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { createNotification } from "@/services/in-app-notifications";
import { notifyFollow } from "@/services/notifications";
import type { Profile } from "@/services/database.types";

export async function fetchSuggestedUsers(
  userId: string,
  department?: string,
  limit: number = 3
): Promise<Pick<Profile, "id" | "name" | "department" | "avatar_url">[]> {
  return withRetry(async () => {
    let profiles = await db_ops.query("profiles", {
      conditions: [{ field: "id", op: "!=", value: userId }],
      limitCount: 20,
    });

    if (department) {
      const sameDept = profiles.filter((p) => p.department === department);
      if (sameDept.length >= limit) return sameDept.slice(0, limit);

      const otherIds = new Set(sameDept.map((p) => p.id));
      const others = profiles.filter((p) => !otherIds.has(p.id));
      return [...sameDept, ...others].slice(0, limit) as any;
    }

    return profiles.slice(0, limit) as any;
  });
}

export async function followUser(followingId: string): Promise<void> {
  return withRetry(async () => {
    const user = getCurrentUser();
    const followId = `${user.uid}_${followingId}`;
    await db_ops.set("follows", followId, {
      follower_id: user.uid,
      following_id: followingId,
    });
    createNotification(followingId, user.uid, "follow", "profile", user.uid);
    const sender = await db_ops.get("profiles", user.uid);
    notifyFollow(followingId, sender?.name ?? "Someone", user.uid).catch(() => {});
  });
}

export async function unfollowUser(followingId: string): Promise<void> {
  return withRetry(async () => {
    const user = getCurrentUser();
    const followId = `${user.uid}_${followingId}`;
    await db_ops.delete("follows", followId);
  });
}

export async function getMutualFollows(
  userId: string
): Promise<Pick<Profile, "id" | "name" | "department" | "avatar_url" | "verification_status">[]> {
  return withRetry(async () => {
    const [following, followers] = await Promise.all([
      db_ops.query("follows", {
        conditions: [{ field: "follower_id", op: "==", value: userId }],
      }),
      db_ops.query("follows", {
        conditions: [{ field: "following_id", op: "==", value: userId }],
      }),
    ]);

    const followingIds = new Set(following.map((f: any) => f.following_id));
    const followerIds = new Set(followers.map((f: any) => f.follower_id));
    const mutualIds = [...followingIds].filter((id) => followerIds.has(id));

    if (mutualIds.length === 0) return [];

    const profiles = await Promise.all(
      mutualIds.map((id) => db_ops.get("profiles", id))
    );
    return profiles.filter(Boolean) as any;
  });
}
