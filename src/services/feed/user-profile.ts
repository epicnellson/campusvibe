import { db_ops } from "@/services/db";
import { db } from "@/services/firebase";
import { collection, query, where, limit as fbLimit, getDocs } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY_PREFIX = "feed_user_profile_";
const CACHE_TTL = 10 * 60 * 1000;

export type CachedUserProfile = {
  id: string;
  name: string;
  department: string | null;
  year: string | null;
  avatarUrl: string | null;
  friendIds: Set<string>;
  followerIds: Set<string>;
  followingIds: Set<string>;
  mutualFriendIds: Set<string>;
  departmentPeers: Set<string>;
  loadedAt: number;
};

let cachedProfile: CachedUserProfile | null = null;

export async function getUserProfile(userId: string): Promise<CachedUserProfile> {
  if (cachedProfile && cachedProfile.id === userId && Date.now() - cachedProfile.loadedAt < CACHE_TTL) {
    return cachedProfile;
  }

  const stored = await loadFromStorage(userId);
  if (stored && Date.now() - stored.loadedAt < CACHE_TTL) {
    cachedProfile = stored;
    return stored;
  }

  const profile = await fetchFullProfile(userId);
  cachedProfile = profile;
  saveToStorage(userId, profile).catch(() => {});
  return profile;
}

export function getCachedProfile(): CachedUserProfile | null {
  return cachedProfile;
}

function invalidateCache(): void {
  cachedProfile = null;
}

async function fetchFullProfile(userId: string): Promise<CachedUserProfile> {
  const me = await db_ops.get("profiles", userId);

  const friendIds = new Set<string>();
  const followerIds = new Set<string>();
  const followingIds = new Set<string>();

  const [followersSnap, followingSnap] = await Promise.all([
    getDocs(query(collection(db, "follows"), where("following_id", "==", userId), fbLimit(200))),
    getDocs(query(collection(db, "follows"), where("follower_id", "==", userId), fbLimit(200))),
  ]);

  for (const doc of followersSnap.docs) {
    const data = doc.data();
    const fid = data.follower_id as string;
    followerIds.add(fid);
  }

  for (const doc of followingSnap.docs) {
    const data = doc.data();
    const fid = data.following_id as string;
    followingIds.add(fid);
  }

  for (const fid of followerIds) {
    if (followingIds.has(fid)) friendIds.add(fid);
  }

  const departmentPeers = new Set<string>();
  if (me?.department) {
    const peersSnap = await getDocs(
      query(collection(db, "profiles"), where("department", "==", me.department), fbLimit(50))
    );
    for (const doc of peersSnap.docs) {
      if (doc.id !== userId) departmentPeers.add(doc.id);
    }
  }

  return {
    id: userId,
    name: me?.name ?? "",
    department: me?.department ?? null,
    year: me?.year ?? null,
    avatarUrl: me?.avatar_url ?? null,
    friendIds,
    followerIds,
    followingIds,
    mutualFriendIds: friendIds,
    departmentPeers,
    loadedAt: Date.now(),
  };
}

async function loadFromStorage(userId: string): Promise<CachedUserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      ...data,
      friendIds: new Set(data.friendIds ?? []),
      followerIds: new Set(data.followerIds ?? []),
      followingIds: new Set(data.followingIds ?? []),
      mutualFriendIds: new Set(data.mutualFriendIds ?? []),
      departmentPeers: new Set(data.departmentPeers ?? []),
    };
  } catch {
    return null;
  }
}

async function saveToStorage(userId: string, profile: CachedUserProfile): Promise<void> {
  try {
    const data = {
      ...profile,
      friendIds: [...profile.friendIds],
      followerIds: [...profile.followerIds],
      followingIds: [...profile.followingIds],
      mutualFriendIds: [...profile.mutualFriendIds],
      departmentPeers: [...profile.departmentPeers],
    };
    await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(data));
  } catch {}
}

export function invalidateUserProfile(): void {
  invalidateCache();
}
