const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const UPSTREAM_TIMEOUT_MS = 8000

function badRequest(msg: string): Response {
  return Response.json({ error: msg }, { status: 400, headers: CORS_HEADERS })
}

function notFound(): Response {
  return Response.json({ error: "Unknown provider" }, { status: 404, headers: CORS_HEADERS })
}

function timeoutError(provider: string): Response {
  return Response.json({ error: `${provider} upstream timeout` }, { status: 504, headers: CORS_HEADERS })
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = UPSTREAM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("UPSTREAM_TIMEOUT")
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function proxyYouTube(params: URLSearchParams): Promise<Response> {
  const key = Deno.env.get("YOUTUBE_API_KEY")
  if (!key) return badRequest("YouTube API key not configured")

  const type = params.get("type") ?? "popular"
  const pageSize = params.get("pageSize") ?? "20"

  if (type === "popular") {
    const pageToken = params.get("pageToken") ?? ""
    const pageParam = pageToken ? `&pageToken=${pageToken}` : ""
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=${pageSize}&key=${key}${pageParam}`
    )
    if (!res.ok) return Response.json({ error: `YouTube ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
    return Response.json(await res.json(), { headers: CORS_HEADERS })
  }

  if (type === "search") {
    const q = params.get("q") ?? ""
    const pageToken = params.get("pageToken") ?? ""
    const pageParam = pageToken ? `&pageToken=${pageToken}` : ""
    // Localize results to English content: relevanceLanguage + regionCode make
    // searches return English-language videos even for non-English IPs.
    const languageParam = params.get("relevanceLanguage") ?? "en"
    const regionParam = params.get("regionCode") ?? "US"
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=${Math.min(parseInt(pageSize), 10)}&key=${key}&relevanceLanguage=${languageParam}&regionCode=${regionParam}${pageParam}`
    )
    if (!res.ok) return Response.json({ error: `YouTube search ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
    return Response.json(await res.json(), { headers: CORS_HEADERS })
  }

  return badRequest("Invalid YouTube type")
}

async function proxyNews(params: URLSearchParams): Promise<Response> {
  const key = Deno.env.get("NEWS_API_KEY")
  if (!key) return badRequest("News API key not configured")

  const q = params.get("q") ?? "university"
  const page = params.get("page") ?? "1"
  const pageSize = params.get("pageSize") ?? "20"

  const res = await fetchWithTimeout(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&pageSize=${pageSize}&page=${page}&sortBy=publishedAt&apiKey=${key}`
  )
  if (!res.ok) return Response.json({ error: `NewsAPI ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
  return Response.json(await res.json(), { headers: CORS_HEADERS })
}

async function proxyUnsplash(params: URLSearchParams): Promise<Response> {
  const key = Deno.env.get("UNSPLASH_ACCESS_KEY")
  if (!key) return badRequest("Unsplash API key not configured")

  const q = params.get("q") ?? "campus"
  const page = params.get("page") ?? "1"
  const perPage = params.get("perPage") ?? "20"
  const orientation = params.get("orientation") ?? ""

  const orientParam = orientation ? `&orientation=${orientation}` : ""
  const res = await fetchWithTimeout(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&order_by=relevant${orientParam}`,
    { headers: { Authorization: `Client-ID ${key}` } }
  )
  if (!res.ok) return Response.json({ error: `Unsplash ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
  return Response.json(await res.json(), { headers: CORS_HEADERS })
}

async function proxyMastodon(params: URLSearchParams): Promise<Response> {
  const token = Deno.env.get("MASTODON_ACCESS_TOKEN")
  if (!token) return badRequest("Mastodon token not configured")

  const q = params.get("q") ?? ""
  const maxId = params.get("max_id") ?? ""
  const limit = params.get("limit") ?? "20"

  const searchParams = new URLSearchParams({ q, limit, resolve: "false" })
  if (maxId) searchParams.set("max_id", maxId)

  const res = await fetchWithTimeout(`https://mastodon.social/api/v2/search?${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return Response.json({ error: `Mastodon ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
  return Response.json(await res.json(), { headers: CORS_HEADERS })
}

async function proxyGiphy(params: URLSearchParams): Promise<Response> {
  const key = Deno.env.get("GIPHY_API_KEY")
  if (!key) return badRequest("Giphy API key not configured")

  const type = params.get("type") ?? "trending"
  const q = params.get("q") ?? ""
  const offset = params.get("offset") ?? "0"
  const limit = params.get("limit") ?? "20"

  if (type === "trending") {
    const res = await fetchWithTimeout(
      `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=${limit}&offset=${offset}&rating=g`
    )
    if (!res.ok) return Response.json({ error: `Giphy ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
    return Response.json(await res.json(), { headers: CORS_HEADERS })
  }

  if (type === "search") {
    const res = await fetchWithTimeout(
      `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${Math.min(parseInt(limit), 10)}&offset=${offset}&rating=g`
    )
    if (!res.ok) return Response.json({ error: `Giphy search ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
    return Response.json(await res.json(), { headers: CORS_HEADERS })
  }

  return badRequest("Invalid Giphy type")
}

async function proxyPexels(params: URLSearchParams): Promise<Response> {
  const key = Deno.env.get("PEXELS_API_KEY")
  if (!key) return badRequest("Pexels API key not configured")

  const type = params.get("type") ?? "photo"
  const q = params.get("q") ?? "campus"
  const page = params.get("page") ?? "1"
  const perPage = params.get("perPage") ?? "20"

  const endpoint = type === "video"
    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`
    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`

  const res = await fetchWithTimeout(endpoint, { headers: { Authorization: key } })
  if (!res.ok) return Response.json({ error: `Pexels ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
  return Response.json(await res.json(), { headers: CORS_HEADERS })
}

async function proxyBluesky(params: URLSearchParams): Promise<Response> {
  const q = params.get("q") ?? "campus"
  const limit = params.get("limit") ?? "15"
  const cursor = params.get("cursor") ?? ""

  const searchParams = new URLSearchParams({ q, limit })
  if (cursor) searchParams.set("cursor", cursor)

  const res = await fetchWithTimeout(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${searchParams}`, {
    headers: { "User-Agent": "CampusVibe/1.0" },
  })
  if (!res.ok) return Response.json({ error: `Bluesky ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
  return Response.json(await res.json(), { headers: CORS_HEADERS })
}

const REDDIT_USER_AGENT = "web:campusvibe:v1.0.0 (by /u/campusvibe)"

async function proxyReddit(params: URLSearchParams): Promise<Response> {
  const subreddit = params.get("subreddit") ?? "funny"
  const limit = Math.min(parseInt(params.get("limit") ?? "20") || 20, 25)
  const after = params.get("after") ?? ""
  const afterParam = after ? `&after=${after}` : ""

  const res = await fetchWithTimeout(
    `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=${limit}${afterParam}`,
    { headers: { "User-Agent": REDDIT_USER_AGENT } }
  )
  // Reddit rate-limits/blocks cloud IPs. Treat 403/429 as an empty listing so
  // the client's multi-provider fallback (Pexels/GIPHY/campus) continues smoothly.
  if (res.status === 403 || res.status === 429) {
    return Response.json({ data: { children: [], after: null } }, { headers: CORS_HEADERS })
  }
  if (!res.ok) return Response.json({ error: `Reddit ${res.status}` }, { status: res.status, headers: CORS_HEADERS })
  return Response.json(await res.json(), { headers: CORS_HEADERS })
}

const ROUTERS: Record<string, (params: URLSearchParams) => Promise<Response>> = {
  youtube: proxyYouTube,
  news: proxyNews,
  unsplash: proxyUnsplash,
  mastodon: proxyMastodon,
  giphy: proxyGiphy,
  pexels: proxyPexels,
  bluesky: proxyBluesky,
  reddit: proxyReddit,
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const provider = url.searchParams.get("provider")

  if (!provider || !(provider in ROUTERS)) {
    return notFound()
  }

  try {
    return await ROUTERS[provider](url.searchParams)
  } catch (err: any) {
    if (err?.message === "UPSTREAM_TIMEOUT") {
      return timeoutError(provider)
    }
    console.error(`[feed-proxy] ${provider} error:`, err)
    return Response.json({ error: "Provider request failed" }, { status: 502, headers: CORS_HEADERS })
  }
})
