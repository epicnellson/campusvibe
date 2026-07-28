import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "feed_trending_v1";

export type TrendingItem = {
  id: string;
  source: string;
  velocity: number;
  totalEngagement: number;
  ageHours: number;
  computedAt: number;
};

let cachedTrending: Map<string, TrendingItem> | null = null;

export async function loadTrendingCache(): Promise<Map<string, TrendingItem>> {
  if (cachedTrending) return cachedTrending;

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      cachedTrending = new Map();
      return cachedTrending;
    }
    const entries: [string, TrendingItem][] = JSON.parse(raw);
    cachedTrending = new Map(entries);
    pruneStale(cachedTrending);
    return cachedTrending;
  } catch {
    cachedTrending = new Map();
    return cachedTrending;
  }
}

export function computeTrendingScore(item: {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  publishedAt: Date | null;
}): number {
  if (!item.publishedAt) return 0;

  const ageHours = Math.max(0.1, (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60));
  const likes = item.likeCount ?? 0;
  const comments = item.commentCount ?? 0;
  const shares = item.shareCount ?? 0;

  const totalEngagement = likes * 1 + comments * 3 + shares * 5;
  const velocity = totalEngagement / Math.max(1, ageHours);

  const velocityNorm = Math.min(1, velocity / 10);
  const recencyBonus = Math.max(0, 1 - ageHours / 24);
  const engagementBonus = Math.min(1, totalEngagement / 20);

  return 0.4 * velocityNorm + 0.35 * recencyBonus + 0.25 * engagementBonus;
}

export function updateTrendingCache(items: Array<{
  id: string;
  source: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  publishedAt: Date | null;
}>): void {
  if (!cachedTrending) cachedTrending = new Map();

  for (const item of items) {
    const ageHours = item.publishedAt
      ? Math.max(0.1, (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60))
      : 999;
    const totalEngagement = (item.likeCount ?? 0) + (item.commentCount ?? 0) * 3 + (item.shareCount ?? 0) * 5;
    const velocity = totalEngagement / Math.max(1, ageHours);

    cachedTrending.set(item.id, {
      id: item.id,
      source: item.source,
      velocity,
      totalEngagement,
      ageHours,
      computedAt: Date.now(),
    });
  }

  pruneStale(cachedTrending);
  persistTrendingCache(cachedTrending).catch(() => {});
}

export function getTrendingScore(id: string): number {
  const item = cachedTrending?.get(id);
  if (!item) return 0;

  const ageHours = Math.max(0.1, (Date.now() - item.computedAt) / (1000 * 60 * 60) + item.ageHours);
  const recencyBonus = Math.max(0, 1 - ageHours / 24);
  const velocityNorm = Math.min(1, item.velocity / 10);
  const engagementBonus = Math.min(1, item.totalEngagement / 20);

  return 0.4 * velocityNorm + 0.35 * recencyBonus + 0.25 * engagementBonus;
}

function pruneStale(cache: Map<string, TrendingItem>): void {
  const now = Date.now();
  const maxAge = 48 * 60 * 60 * 1000;
  for (const [id, item] of cache) {
    if (now - item.computedAt > maxAge) {
      cache.delete(id);
    }
  }
}

async function persistTrendingCache(cache: Map<string, TrendingItem>): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify([...cache]));
  } catch {}
}
