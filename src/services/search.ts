import { db_ops } from "@/services/db";
import { withRetry } from "@/services/retry";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "search_history_v1";
const MAX_HISTORY = 20;

export type SearchUser = {
  id: string;
  name: string;
  department: string;
  year: string;
  avatar_url?: string;
  verification_status?: string;
};

export type SearchPost = {
  id: string;
  content: string;
  image_url?: string;
  user_id: string;
  created_at: string;
  authorName?: string;
  authorAvatar?: string;
};

export type SearchEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  image_url?: string;
};

export type SearchListing = {
  id: string;
  title: string;
  description: string;
  price: string;
  category: string;
  photos: string[];
  user_id: string;
  created_at: string;
  sellerName?: string;
};

export type SearchResult = {
  users: SearchUser[];
  posts: SearchPost[];
  events: SearchEvent[];
  listings: SearchListing[];
};

async function searchUsers(term: string): Promise<SearchUser[]> {
  const profiles = await db_ops.query("profiles", { limitCount: 100 });
  const lower = term.toLowerCase();
  return profiles
    .filter((p: any) => p.name?.toLowerCase().includes(lower) || p.department?.toLowerCase().includes(lower))
    .slice(0, 10)
    .map((p: any) => ({
      id: p.id,
      name: p.name ?? "",
      department: p.department ?? "",
      year: p.year ?? "",
      avatar_url: p.avatar_url,
      verification_status: p.verification_status,
    }));
}

async function searchPosts(term: string): Promise<SearchPost[]> {
  const posts = await db_ops.query("posts", {
    orderBy: [{ field: "created_at", direction: "desc" }],
    limitCount: 100,
  });
  const lower = term.toLowerCase();
  const matched = posts
    .filter((p: any) => p.content?.toLowerCase().includes(lower))
    .slice(0, 10);

  const authorIds = [...new Set(matched.map((p: any) => p.user_id).filter(Boolean))];
  const profiles = await Promise.all(authorIds.map((id) => db_ops.get("profiles", id)));
  const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p]));

  return matched.map((p: any) => ({
    id: p.id,
    content: p.content ?? "",
    image_url: p.image_url,
    user_id: p.user_id,
    created_at: p.created_at ?? "",
    authorName: profileMap.get(p.user_id)?.name,
    authorAvatar: profileMap.get(p.user_id)?.avatar_url,
  })) as SearchPost[];
}

async function searchEvents(term: string): Promise<SearchEvent[]> {
  const events = await db_ops.query("events", { limitCount: 100 });
  const lower = term.toLowerCase();
  return events
    .filter((e: any) => e.title?.toLowerCase().includes(lower) || e.description?.toLowerCase().includes(lower) || e.location?.toLowerCase().includes(lower))
    .slice(0, 10)
    .map((e: any) => ({
      id: e.id,
      title: e.title ?? "",
      description: e.description ?? "",
      date: e.date ?? "",
      time: e.time ?? "",
      location: e.location ?? "",
      image_url: e.image_url,
    }));
}

async function searchListings(term: string): Promise<SearchListing[]> {
  const listings = await db_ops.query("listings", {
    orderBy: [{ field: "created_at", direction: "desc" }],
    limitCount: 100,
  });
  const lower = term.toLowerCase();
  const matched = listings
    .filter((l: any) => l.title?.toLowerCase().includes(lower) || l.description?.toLowerCase().includes(lower) || l.category?.toLowerCase().includes(lower))
    .slice(0, 10);

  const sellerIds = [...new Set(matched.map((l: any) => l.user_id).filter(Boolean))];
  const profiles = await Promise.all(sellerIds.map((id) => db_ops.get("profiles", id)));
  const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p]));

  return matched.map((l: any) => ({
    id: l.id,
    title: l.title ?? "",
    description: l.description ?? "",
    price: l.price ?? "",
    category: l.category ?? "",
    photos: l.photos ?? [],
    user_id: l.user_id,
    created_at: l.created_at ?? "",
    sellerName: profileMap.get(l.user_id)?.name,
  })) as SearchListing[];
}

export async function performSearch(term: string): Promise<SearchResult> {
  return withRetry(async () => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return { users: [], posts: [], events: [], listings: [] };

    const [users, posts, events, listings] = await Promise.all([
      searchUsers(trimmed),
      searchPosts(trimmed),
      searchEvents(trimmed),
      searchListings(trimmed),
    ]);

    return { users, posts, events, listings };
  });
}

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addSearchHistory(term: string): Promise<void> {
  try {
    const history = await getSearchHistory();
    const filtered = history.filter((h) => h.toLowerCase() !== term.toLowerCase());
    const updated = [term, ...filtered].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
}
