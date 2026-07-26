import AsyncStorage from "@react-native-async-storage/async-storage";

const SEEN_PREFIX = "feed_seen_";
const MAX_SEEN = 500;

function key(userId: string) {
  return `${SEEN_PREFIX}${userId}`;
}

export async function getSeenIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export async function markSeen(userId: string, ids: string[]): Promise<void> {
  try {
    const seen = await getSeenIds(userId);
    for (const id of ids) seen.add(id);
    const arr = Array.from(seen);
    const trimmed = arr.slice(arr.length - MAX_SEEN);
    await AsyncStorage.setItem(key(userId), JSON.stringify(trimmed));
  } catch {}
}

export async function clearSeenIds(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {}
}
