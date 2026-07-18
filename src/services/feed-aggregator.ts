import { supabase } from "./supabase";

export type ExternalFeedItem = {
  id: string;
  source: "unsplash" | "newsapi" | "youtube";
  type: "image" | "news" | "video";
  title: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  link?: string;
  author?: string;
  published_at?: string;
};

export async function fetchExternalFeed(userId?: string): Promise<ExternalFeedItem[]> {
  try {
    const params = userId ? `?user_id=${userId}` : "";
    const { data, error } = await supabase.functions.invoke(`feed-aggregator${params}`, {
      method: "GET",
    });
    if (error) {
      console.error("[feed-aggregator] invoke error:", error);
      return [];
    }
    return data?.items ?? [];
  } catch (e) {
    console.error("[fetchExternalFeed] failed:", e);
    return [];
  }
}
