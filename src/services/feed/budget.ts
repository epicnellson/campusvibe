import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "feed_cache_";
const RATE_PREFIX = "feed_rate_";
const BACKOFF_PREFIX = "feed_backoff_";
const DEDUP_PREFIX = "feed_dedup_";
const BUDGET_PREFIX = "feed_budget_";

const FIFTEEN_MIN = 15 * 60 * 1000;

export type ProviderQuota = {
  dailyLimit: number;
  cooldownMs: number;
  cacheTtlMs: number;
};

export const PROVIDER_QUOTAS: Record<string, ProviderQuota> = {
  youtube:  { dailyLimit: 500,  cooldownMs: FIFTEEN_MIN, cacheTtlMs: 30 * 60 * 1000 },
  news:     { dailyLimit: 90,   cooldownMs: FIFTEEN_MIN, cacheTtlMs: 15 * 60 * 1000 },
  unsplash: { dailyLimit: 45,   cooldownMs: FIFTEEN_MIN, cacheTtlMs: 60 * 60 * 1000 },
  mastodon: { dailyLimit: 280,  cooldownMs: FIFTEEN_MIN, cacheTtlMs: 10 * 60 * 1000 },
  giphy:    { dailyLimit: 40,   cooldownMs: FIFTEEN_MIN, cacheTtlMs: 30 * 60 * 1000 },
  pexels:   { dailyLimit: 180,  cooldownMs: FIFTEEN_MIN, cacheTtlMs: 60 * 60 * 1000 },
  bluesky:  { dailyLimit: 9999, cooldownMs: 0,          cacheTtlMs: 5 * 60 * 1000 },
};

function getDedupWindow(provider: string): number {
  const quota = PROVIDER_QUOTAS[provider];
  if (!quota) return FIFTEEN_MIN;
  return Math.min(quota.cacheTtlMs, 30 * 60 * 1000);
}

type CacheEntry = { data: unknown; storedAt: number };
type RateEntry = { lastRequestAt: number; requestCount: number; windowStart: number };
type BackoffEntry = { failureCount: number; nextRetryAt: number };
type DedupEntry = { requestedAt: number };
type BudgetEntry = { used: number; dayStart: number };

function hashParams(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = sorted.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (hash >>> 0).toString(36);
}

async function get<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ── Cache ──

export async function getCachedResponse(provider: string, params: Record<string, string>): Promise<unknown | null> {
  const quota = PROVIDER_QUOTAS[provider];
  if (!quota) return null;
  const entry = await get<CacheEntry>(`${CACHE_PREFIX}${provider}_${hashParams(params)}`);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > quota.cacheTtlMs) return null;
  return entry.data;
}

export async function setCachedResponse(provider: string, params: Record<string, string>, data: unknown): Promise<void> {
  const key = `${CACHE_PREFIX}${provider}_${hashParams(params)}`;
  await set(key, { data, storedAt: Date.now() });
}

// ── Rate limiter ──

export async function canMakeRequest(provider: string): Promise<boolean> {
  const quota = PROVIDER_QUOTAS[provider];
  if (!quota) return true;
  if (quota.cooldownMs <= 0) return true;

  const entry = await get<RateEntry>(`${RATE_PREFIX}${provider}`);
  if (!entry) return true;

  if (Date.now() - entry.lastRequestAt < quota.cooldownMs) return false;
  return true;
}

export async function recordRequest(provider: string): Promise<void> {
  const entry = await get<RateEntry>(`${RATE_PREFIX}${provider}`) ?? { lastRequestAt: 0, requestCount: 0, windowStart: Date.now() };
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (now - entry.windowStart > dayMs) {
    await set(`${RATE_PREFIX}${provider}`, { lastRequestAt: now, requestCount: 1, windowStart: now });
  } else {
    await set(`${RATE_PREFIX}${provider}`, { ...entry, lastRequestAt: now, requestCount: entry.requestCount + 1 });
  }
}

// ── Request dedup ──

export async function wasRecentlyRequested(provider: string, params: Record<string, string>): Promise<boolean> {
  const key = `${DEDUP_PREFIX}${provider}_${hashParams(params)}`;
  const entry = await get<DedupEntry>(key);
  if (!entry) return false;
  const window = getDedupWindow(provider);
  if (Date.now() - entry.requestedAt > window) return false;
  return true;
}

export async function markRequested(provider: string, params: Record<string, string>): Promise<void> {
  const key = `${DEDUP_PREFIX}${provider}_${hashParams(params)}`;
  await set(key, { requestedAt: Date.now() });
}

// ── Exponential backoff ──

export async function getBackoff(provider: string): Promise<number> {
  const entry = await get<BackoffEntry>(`${BACKOFF_PREFIX}${provider}`);
  if (!entry) return 0;
  if (Date.now() < entry.nextRetryAt) return entry.nextRetryAt - Date.now();
  return 0;
}

export async function recordFailure(provider: string): Promise<void> {
  const entry = await get<BackoffEntry>(`${BACKOFF_PREFIX}${provider}`) ?? { failureCount: 0, nextRetryAt: 0 };
  const count = entry.failureCount + 1;
  const delay = Math.min(1000 * Math.pow(2, count - 1), 120_000);
  await set(`${BACKOFF_PREFIX}${provider}`, { failureCount: count, nextRetryAt: Date.now() + delay });
}

export async function recordSuccess(provider: string): Promise<void> {
  await set(`${BACKOFF_PREFIX}${provider}`, { failureCount: 0, nextRetryAt: 0 });
}

// ── Budget tracker ──

export async function getRemainingBudget(provider: string): Promise<number> {
  const quota = PROVIDER_QUOTAS[provider];
  if (!quota) return Infinity;
  const entry = await get<BudgetEntry>(`${BUDGET_PREFIX}${provider}`);
  if (!entry) return quota.dailyLimit;
  const now = Date.now();
  if (now - entry.dayStart > 24 * 60 * 60 * 1000) return quota.dailyLimit;
  return Math.max(0, quota.dailyLimit - entry.used);
}

export async function consumeBudget(provider: string, units: number = 1): Promise<void> {
  const entry = await get<BudgetEntry>(`${BUDGET_PREFIX}${provider}`) ?? { used: 0, dayStart: Date.now() };
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - entry.dayStart > dayMs) {
    await set(`${BUDGET_PREFIX}${provider}`, { used: units, dayStart: now });
  } else {
    await set(`${BUDGET_PREFIX}${provider}`, { used: entry.used + units, dayStart: entry.dayStart });
  }
}

// ── Combined check ──

export type FetchDecision = { allowed: true } | { allowed: false; reason: "cooldown" | "backoff" | "budget" | "dedup" };

export async function shouldFetch(provider: string, params: Record<string, string>): Promise<FetchDecision> {
  if (await wasRecentlyRequested(provider, params)) return { allowed: false, reason: "dedup" };
  if (!(await canMakeRequest(provider))) return { allowed: false, reason: "cooldown" };
  const backoffMs = await getBackoff(provider);
  if (backoffMs > 0) return { allowed: false, reason: "backoff" };
  if ((await getRemainingBudget(provider)) <= 0) return { allowed: false, reason: "budget" };
  return { allowed: true };
}

export async function recordFetchResult(provider: string, params: Record<string, string>, success: boolean): Promise<void> {
  await markRequested(provider, params);
  await recordRequest(provider);
  if (success) {
    await recordSuccess(provider);
    await consumeBudget(provider);
  } else {
    await recordFailure(provider);
  }
}

// ── Cleanup (call periodically) ──

const ALL_KEYS = [CACHE_PREFIX, RATE_PREFIX, BACKOFF_PREFIX, DEDUP_PREFIX, BUDGET_PREFIX];

export async function cleanupBudgetStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter((k) => ALL_KEYS.some((prefix) => k.startsWith(prefix)));
    if (stale.length > 200) {
      const toRemove = stale.slice(0, stale.length - 150);
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {}
}

// ── Reset transient state (rate, dedup, backoff, cache) on cold start ──

export async function clearTransientState(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const transient = keys.filter((k) =>
      k.startsWith(RATE_PREFIX) ||
      k.startsWith(DEDUP_PREFIX) ||
      k.startsWith(BACKOFF_PREFIX) ||
      k.startsWith(CACHE_PREFIX)
    );
    if (transient.length > 0) {
      await AsyncStorage.multiRemove(transient);
    }
  } catch {}
}
