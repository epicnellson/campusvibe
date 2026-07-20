import { supabase } from "./supabase";

export type ExternalFeedItem = {
  id: string;
  source: "unsplash" | "youtube";
  type: "image" | "video";
  title: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  link?: string;
  author?: string;
  published_at?: string;
};

const UNSPLASH_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY ?? "";
const YOUTUBE_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? "";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchUnsplash(): Promise<ExternalFeedItem[]> {
  if (!UNSPLASH_KEY) return [];
  try {
    const res = await fetch(
      "https://api.unsplash.com/photos/random?query=campus+students+study+lifestyle&count=10&orientation=landscape",
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) return [];
    const photos = await res.json();
    return (photos as any[]).map((p: any) => ({
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
    }));
  } catch {
    return [];
  }
}

async function fetchYouTube(): Promise<ExternalFeedItem[]> {
  if (!YOUTUBE_KEY) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=SL&maxResults=10&key=${YOUTUBE_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
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
    }));
  } catch {
    return [];
  }
}

export async function fetchExternalFeed(userId?: string): Promise<ExternalFeedItem[]> {
  try {
    const [unsplash, youtube] = await Promise.all([
      fetchUnsplash(),
      fetchYouTube(),
    ]);

    let allItems = [...unsplash, ...youtube];

    // Filter out already-seen items (best-effort, non-blocking)
    if (userId && allItems.length > 0) {
      try {
        const { data: seen } = await supabase
          .from("seen_posts" as any)
          .select("external_id")
          .eq("user_id", userId)
          .gte("seen_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const seenIds = new Set((seen ?? []).map((s: any) => s.external_id));
        allItems = allItems.filter((item) => !seenIds.has(item.id));

        if (allItems.length > 0) {
          const toInsert = allItems.slice(0, 30).map((item) => ({
            user_id: userId,
            external_id: item.id,
            source: item.source,
          }));
          await supabase.from("seen_posts" as any).insert(toInsert);
        }
      } catch {
        // seen_posts table may not exist yet — ignore
      }
    }

    return shuffleArray(allItems);
  } catch {
    return [];
  }
}
