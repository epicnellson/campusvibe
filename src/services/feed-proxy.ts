import {
  shouldFetch,
  recordFetchResult,
  getCachedResponse,
  setCachedResponse,
  cleanupBudgetStorage,
} from "./feed/budget";

const PROXY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/feed-proxy`;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Keep this BELOW the composer's PROVIDER_TIMEOUT_MS (12s) so a hung edge
// function resolves here as a silent skip instead of the provider layer's
// harder AbortError.
const PROXY_TIMEOUT_MS = 10000;

type ProxyParams = Record<string, string>;

let cleanupScheduled = false;

function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setTimeout(() => {
    cleanupBudgetStorage().catch(() => {});
    cleanupScheduled = false;
  }, 30_000);
}

export async function feedProxy(provider: string, params: ProxyParams = {}, signal?: AbortSignal): Promise<any> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const cleanParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      cleanParams[k] = v;
    }
  }

  const cached = await getCachedResponse(provider, cleanParams);
  if (cached !== null) return cached;

  const decision = await shouldFetch(provider, cleanParams);
  if (!decision.allowed) {
    scheduleCleanup();
    return { _skipped: true, _reason: decision.reason, items: [], data: {} };
  }

  const url = new URL(PROXY_URL);
  url.searchParams.set("provider", provider);
  for (const [k, v] of Object.entries(cleanParams)) {
    url.searchParams.set(k, v);
  }

  const headers: Record<string, string> = {};
  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  const onParentAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onParentAbort, { once: true });
  }

  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    if (res.status === 403 || res.status === 429) {
      await recordFetchResult(provider, cleanParams, false);
      scheduleCleanup();
      return { _skipped: true, _reason: `rate_limited_${res.status}`, items: [], data: {} };
    }
    if (res.status >= 500) {
      // 5xx (including 502/504 Gateway Timeout) → silent skip so this single
      // provider never disrupts the other successful API results.
      await recordFetchResult(provider, cleanParams, false);
      scheduleCleanup();
      return { _skipped: true, _reason: `upstream_${res.status}`, items: [], data: {} };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Feed proxy ${res.status}`);
    }
    const data = await res.json();

    await recordFetchResult(provider, cleanParams, true);
    await setCachedResponse(provider, cleanParams, data);
    scheduleCleanup();

    return data;
  } catch (err) {
    if (signal?.aborted) {
      // The caller cancelled — propagate, don't mask it as a skip.
      throw err;
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      // Internal timeout — return a silent skip instead of throwing so a
      // single slow provider (e.g. Mastodon) degrades quietly on its own.
      await recordFetchResult(provider, cleanParams, false);
      scheduleCleanup();
      return { _skipped: true, _reason: "timeout", items: [], data: {} };
    }
    await recordFetchResult(provider, cleanParams, false);
    scheduleCleanup();
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onParentAbort);
  }
}
