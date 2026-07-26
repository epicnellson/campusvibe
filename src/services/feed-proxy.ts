import { auth } from "./firebase";
import {
  shouldFetch,
  recordFetchResult,
  getCachedResponse,
  setCachedResponse,
  cleanupBudgetStorage,
} from "./feed/budget";

const PROXY_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/feed-proxy`;

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

  const user = auth.currentUser;
  const headers: Record<string, string> = {};
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url.toString(), { headers, signal });
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
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    await recordFetchResult(provider, cleanParams, false);
    scheduleCleanup();
    throw err;
  }
}
