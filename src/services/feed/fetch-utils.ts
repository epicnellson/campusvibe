const DEFAULT_TIMEOUT = 6000;
const MAX_RETRIES = 1;
const RETRY_DELAY = 800;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal: parentSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  try {
    const res = await fetch(input, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
  }
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const { retries = MAX_RETRIES, ...rest } = init;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
    }
    try {
      const res = await fetchWithTimeout(input, rest);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError" && rest.signal?.aborted) {
        throw err;
      }
      lastError = err;
    }
  }
  throw lastError;
}

export async function fetchConcurrentIndependent<T>(
  tasks: { key: string; run: (signal: AbortSignal) => Promise<T> }[],
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<Map<string, { ok: true; value: T } | { ok: false; error: unknown }>> {
  const { timeoutMs = DEFAULT_TIMEOUT, signal: parentSignal } = opts;
  const results = new Map<string, { ok: true; value: T } | { ok: false; error: unknown }>();

  const settled = Promise.allSettled(
    tasks.map(async ({ key, run }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const onParentAbort = () => controller.abort();
      if (parentSignal) {
        if (parentSignal.aborted) controller.abort();
        else parentSignal.addEventListener("abort", onParentAbort, { once: true });
      }

      try {
        const value = await run(controller.signal);
        results.set(key, { ok: true, value });
      } catch (error) {
        results.set(key, { ok: false, error });
      } finally {
        clearTimeout(timer);
        if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
      }
    })
  );

  await settled;
  return results;
}
