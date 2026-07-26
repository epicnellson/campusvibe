import { onRequest } from "firebase-functions/v2/https";

const UPSTREAM_TIMEOUT_MS = 8000;

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = UPSTREAM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function proxyYouTube(params: URLSearchParams): Promise<any> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YouTube API key not configured");

  const type = params.get("type") ?? "popular";
  const pageSize = params.get("pageSize") ?? "20";

  if (type === "popular") {
    const pageToken = params.get("pageToken") ?? "";
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=${pageSize}&key=${key}${pageParam}`
    );
    if (!res.ok) throw new Error(`YouTube ${res.status}`);
    return res.json();
  }

  if (type === "search") {
    const q = params.get("q") ?? "";
    const pageToken = params.get("pageToken") ?? "";
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=${Math.min(parseInt(pageSize), 10)}&key=${key}${pageParam}`
    );
    if (!res.ok) throw new Error(`YouTube search ${res.status}`);
    return res.json();
  }

  throw new Error("Invalid YouTube type");
}

async function proxyNews(params: URLSearchParams): Promise<any> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("News API key not configured");

  const q = params.get("q") ?? "university";
  const page = params.get("page") ?? "1";
  const pageSize = params.get("pageSize") ?? "20";

  const res = await fetchWithTimeout(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&pageSize=${pageSize}&page=${page}&sortBy=publishedAt&apiKey=${key}`
  );
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  return res.json();
}

async function proxyUnsplash(params: URLSearchParams): Promise<any> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("Unsplash API key not configured");

  const q = params.get("q") ?? "campus";
  const page = params.get("page") ?? "1";
  const perPage = params.get("perPage") ?? "20";
  const orientation = params.get("orientation") ?? "";

  const orientParam = orientation ? `&orientation=${orientation}` : "";
  const res = await fetchWithTimeout(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&order_by=relevant${orientParam}`,
    { headers: { Authorization: `Client-ID ${key}` } }
  );
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  return res.json();
}

async function proxyMastodon(params: URLSearchParams): Promise<any> {
  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!token) throw new Error("Mastodon token not configured");

  const q = params.get("q") ?? "";
  const maxId = params.get("max_id") ?? "";
  const limit = params.get("limit") ?? "20";

  const searchParams = new URLSearchParams({ q, limit, resolve: "false" });
  if (maxId) searchParams.set("max_id", maxId);

  const res = await fetchWithTimeout(`https://mastodon.social/api/v2/search?${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Mastodon ${res.status}`);
  return res.json();
}

async function proxyGiphy(params: URLSearchParams): Promise<any> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) throw new Error("Giphy API key not configured");

  const type = params.get("type") ?? "trending";
  const q = params.get("q") ?? "";
  const offset = params.get("offset") ?? "0";
  const limit = params.get("limit") ?? "20";

  if (type === "trending") {
    const res = await fetchWithTimeout(
      `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=${limit}&offset=${offset}&rating=g`
    );
    if (!res.ok) throw new Error(`Giphy ${res.status}`);
    return res.json();
  }

  if (type === "search") {
    const res = await fetchWithTimeout(
      `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${Math.min(parseInt(limit), 10)}&offset=${offset}&rating=g`
    );
    if (!res.ok) throw new Error(`Giphy search ${res.status}`);
    return res.json();
  }

  throw new Error("Invalid Giphy type");
}

async function proxyPexels(params: URLSearchParams): Promise<any> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("Pexels API key not configured");

  const type = params.get("type") ?? "photo";
  const q = params.get("q") ?? "campus";
  const page = params.get("page") ?? "1";
  const perPage = params.get("perPage") ?? "20";

  const endpoint = type === "video"
    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`
    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`;

  const res = await fetchWithTimeout(endpoint, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  return res.json();
}

async function proxyBluesky(params: URLSearchParams): Promise<any> {
  const q = params.get("q") ?? "campus";
  const limit = params.get("limit") ?? "15";
  const cursor = params.get("cursor") ?? "";

  const searchParams = new URLSearchParams({ q, limit });
  if (cursor) searchParams.set("cursor", cursor);

  const res = await fetchWithTimeout(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${searchParams}`, {
    headers: { "User-Agent": "CampusVibe/1.0" },
  });
  if (!res.ok) throw new Error(`Bluesky ${res.status}`);
  return res.json();
}

const ROUTERS: Record<string, (params: URLSearchParams) => Promise<any>> = {
  youtube: proxyYouTube,
  news: proxyNews,
  unsplash: proxyUnsplash,
  mastodon: proxyMastodon,
  giphy: proxyGiphy,
  pexels: proxyPexels,
  bluesky: proxyBluesky,
};

/**
 * GET /feedProxy?provider=youtube&type=popular
 * Proxies API requests to third-party providers,
 * keeping API keys server-side.
 */
export const feedProxy = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url, `https://${req.hostname}`);
  const provider = url.searchParams.get("provider");

  if (!provider || !(provider in ROUTERS)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }

  try {
    const data = await ROUTERS[provider](url.searchParams);
    res.json(data);
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message?.includes("UPSTREAM_TIMEOUT")) {
      res.status(504).json({ error: `${provider} upstream timeout` });
      return;
    }
    console.error(`[feedProxy] ${provider} error:`, err);
    res.status(502).json({ error: "Provider request failed" });
  }
});
