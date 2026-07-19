import { Platform } from "react-native";
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
  if (Platform.OS === "web") return [];
  try {
    const { data, error } = await supabase.functions.invoke("feed-aggregator", {
      method: "POST",
      body: userId ? { user_id: userId } : {},
    });
    if (error) return [];
    return data?.items ?? [];
  } catch {
    return [];
  }
}
