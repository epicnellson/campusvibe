const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ExternalItem = {
  id: string
  source: "unsplash" | "youtube"
  type: "image" | "video"
  title: string
  description?: string
  image_url?: string
  thumbnail_url?: string
  link?: string
  author?: string
  published_at?: string
}

async function fetchUnsplash(): Promise<ExternalItem[]> {
  const key = Deno.env.get("UNSPLASH_API_KEY")
  if (!key) return []
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=campus+students+study+lifestyle&count=10&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    if (!res.ok) return []
    const photos = await res.json()
    return (photos as any[]).map((p) => ({
      id: `unsplash-${p.id}`,
      source: "unsplash" as const,
      type: "image" as const,
      title: p.alt_description || "Campus life",
      description: p.user?.name ? `Photo by ${p.user.name}` : undefined,
      image_url: p.urls?.regular,
      thumbnail_url: p.urls?.thumb,
      link: p.links?.html,
      author: p.user?.name,
      published_at: p.created_at,
    }))
  } catch (e) {
    console.error("[feed-aggregator] Unsplash error:", e)
    return []
  }
}

async function fetchYouTube(): Promise<ExternalItem[]> {
  const key = Deno.env.get("YOUTUBE_API_KEY")
  if (!key) return []
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=SL&maxResults=10&key=${key}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((v: any) => ({
      id: `yt-${v.id}`,
      source: "youtube" as const,
      type: "video" as const,
      title: v.snippet?.title || "YouTube Video",
      description: v.snippet?.description?.slice(0, 200),
      thumbnail_url: v.snippet?.thumbnails?.medium?.url,
      image_url: v.snippet?.thumbnails?.high?.url,
      link: `https://youtube.com/watch?v=${v.id}`,
      author: v.snippet?.channelTitle,
      published_at: v.snippet?.publishedAt,
    }))
  } catch (e) {
    console.error("[feed-aggregator] YouTube error:", e)
    return []
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const fetch = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const [unsplash, youtube] = await Promise.all([
    fetchUnsplash(),
    fetchYouTube(),
  ])

  const allItems = shuffleArray([...unsplash, ...youtube])

  return Response.json(
    { items: allItems },
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  )
}
