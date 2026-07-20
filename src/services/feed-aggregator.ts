export type ExternalFeedItem = {
  id: string;
  source: "unsplash" | "youtube";
  type: "image" | "video";
  title: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  link?: string;
  video_id?: string;
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
      description: undefined,
      image_url: p.urls?.regular,
      thumbnail_url: p.urls?.thumb,
      link: p.links?.html,
      video_id: undefined,
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
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=10&key=${YOUTUBE_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((v: any) => ({
      id: `yt-${v.id}`,
      source: "youtube" as const,
      type: "video" as const,
      title: v.snippet?.title || "Video",
      description: v.snippet?.description?.slice(0, 200),
      thumbnail_url: v.snippet?.thumbnails?.medium?.url,
      image_url: v.snippet?.thumbnails?.high?.url,
      link: `https://youtube.com/watch?v=${v.id}`,
      video_id: v.id as string,
      published_at: v.snippet?.publishedAt,
    }));
  } catch {
    return [];
  }
}

export async function fetchExternalFeed(): Promise<ExternalFeedItem[]> {
  try {
    const [unsplash, youtube] = await Promise.all([
      fetchUnsplash(),
      fetchYouTube(),
    ]);

    const allItems = [...unsplash, ...youtube];
    return shuffleArray(allItems);
  } catch {
    return [];
  }
}
