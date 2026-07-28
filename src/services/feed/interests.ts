import { db_ops } from "@/services/db";
import { db } from "@/services/firebase";
import { collection, query, where, limit as fbLimit, getDocs, orderBy } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY_PREFIX = "feed_interests_";
const CACHE_TTL = 15 * 60 * 1000;

export type UserInterests = {
  keywords: Map<string, number>;
  emojiPrefs: Map<string, number>;
  departmentAffinity: Map<string, number>;
  authorAffinity: Map<string, number>;
  categoryAffinity: Map<string, number>;
  loadedAt: number;
};

let cachedInterests: UserInterests | null = null;

export async function getUserInterests(userId: string): Promise<UserInterests> {
  if (cachedInterests && Date.now() - cachedInterests.loadedAt < CACHE_TTL) {
    return cachedInterests;
  }

  const stored = await loadFromStorage(userId);
  if (stored && Date.now() - stored.loadedAt < CACHE_TTL) {
    cachedInterests = stored;
    return stored;
  }

  const interests = await buildInterests(userId);
  cachedInterests = interests;
  saveToStorage(userId, interests).catch(() => {});
  return interests;
}

function getCachedKeywords(): Map<string, number> {
  return cachedInterests?.keywords ?? new Map();
}

export function invalidateInterests(): void {
  cachedInterests = null;
}

async function buildInterests(userId: string): Promise<UserInterests> {
  const keywords = new Map<string, number>();
  const emojiPrefs = new Map<string, number>();
  const departmentAffinity = new Map<string, number>();
  const authorAffinity = new Map<string, number>();
  const categoryAffinity = new Map<string, number>();

  const [likesSnap, followsSnap, postsSnap, savedSnap] = await Promise.all([
    getDocs(query(collection(db, "reactions"), where("user_id", "==", userId), fbLimit(100))),
    getDocs(query(collection(db, "follows"), where("follower_id", "==", userId), fbLimit(100))),
    getDocs(query(collection(db, "posts"), where("user_id", "==", userId), orderBy("created_at", "desc"), fbLimit(30))),
    getDocs(query(collection(db, "bookmarks"), where("user_id", "==", userId), fbLimit(50))).catch(() => null),
  ]);

  for (const doc of likesSnap.docs) {
    const data = doc.data();
    if (data.emoji) {
      emojiPrefs.set(data.emoji, (emojiPrefs.get(data.emoji) ?? 0) + 0.3);
    }
  }

  const followedDepartments = new Set<string>();
  for (const doc of followsSnap.docs) {
    const data = doc.data();
    const fid = data.following_id as string;
    authorAffinity.set(fid, (authorAffinity.get(fid) ?? 0) + 0.5);
    try {
      const profile = await db_ops.get("profiles", fid);
      if (profile?.department) {
        followedDepartments.add(profile.department.toLowerCase());
        departmentAffinity.set(profile.department.toLowerCase(), (departmentAffinity.get(profile.department.toLowerCase()) ?? 0) + 0.4);
      }
    } catch {}
  }

  for (const doc of postsSnap.docs) {
    const data = doc.data();
    const content = (data.content ?? "") as string;
    const words = content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    for (const word of words.slice(0, 15)) {
      keywords.set(word, (keywords.get(word) ?? 0) + 0.15);
    }
  }

  if (savedSnap) {
    for (const doc of savedSnap.docs) {
      const data = doc.data();
      if (data.category) {
        categoryAffinity.set(data.category, (categoryAffinity.get(data.category) ?? 0) + 0.4);
      }
    }
  }

  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    study: ["exam", "study", "assignment", "homework", "lecture", "professor", "gpa", "midterm", "final", "class"],
    technology: ["ai", "coding", "programming", "software", "tech", "hack", "startup", "app", "computer", "data"],
    sports: ["game", "football", "basketball", "cricket", "sports", "match", "tournament", "team", "coach", "stadium"],
    memes: ["meme", "funny", "lol", "haha", "bruh", "dead", "literally", "ngl", "fr", "no way"],
    career: ["internship", "job", "career", "resume", "interview", "hiring", "salary", "work", "company", "offer"],
    music: ["song", "album", "concert", "music", "playlist", "artist", "rap", "band", "guitar", "beat"],
    events: ["event", "party", "fest", "festival", "concert", "meetup", "gathering", "celebration", "night"],
    confessions: ["confession", "anonymous", "secret", "crush", "heartbroken", "relationship", "dating", "love"],
    lifestyle: ["food", "cafe", "restaurant", "gym", "fitness", "health", "sleep", "morning", "weekend", "travel"],
    academic: ["research", "paper", "thesis", "degree", "master", "phd", "professor", "department", "faculty", "university"],
  };

  for (const [category, catKeywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of catKeywords) {
      score += keywords.get(kw) ?? 0;
    }
    if (score > 0) {
      categoryAffinity.set(category, (categoryAffinity.get(category) ?? 0) + score);
    }
  }

  return {
    keywords,
    emojiPrefs,
    departmentAffinity,
    authorAffinity,
    categoryAffinity,
    loadedAt: Date.now(),
  };
}

async function loadFromStorage(userId: string): Promise<UserInterests | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      keywords: new Map(data.keywords ?? []),
      emojiPrefs: new Map(data.emojiPrefs ?? []),
      departmentAffinity: new Map(data.departmentAffinity ?? []),
      authorAffinity: new Map(data.authorAffinity ?? []),
      categoryAffinity: new Map(data.categoryAffinity ?? []),
      loadedAt: data.loadedAt ?? 0,
    };
  } catch {
    return null;
  }
}

async function saveToStorage(userId: string, interests: UserInterests): Promise<void> {
  try {
    const data = {
      keywords: [...interests.keywords],
      emojiPrefs: [...interests.emojiPrefs],
      departmentAffinity: [...interests.departmentAffinity],
      authorAffinity: [...interests.authorAffinity],
      categoryAffinity: [...interests.categoryAffinity],
      loadedAt: interests.loadedAt,
    };
    await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(data));
  } catch {}
}

const CATEGORY_KEYWORDS_MAP = {
  study: ["exam", "study", "assignment", "homework", "lecture", "professor", "gpa", "midterm", "final", "class"],
  technology: ["ai", "coding", "programming", "software", "tech", "hack", "startup", "app", "computer", "data"],
  sports: ["game", "football", "basketball", "cricket", "sports", "match", "tournament", "team", "coach", "stadium"],
  memes: ["meme", "funny", "lol", "haha", "bruh", "dead", "literally", "ngl", "fr", "no way"],
  career: ["internship", "job", "career", "resume", "interview", "hiring", "salary", "work", "company", "offer"],
  music: ["song", "album", "concert", "music", "playlist", "artist", "rap", "band", "guitar", "beat"],
  events: ["event", "party", "fest", "festival", "concert", "meetup", "gathering", "celebration", "night"],
  confessions: ["confession", "anonymous", "secret", "crush", "heartbroken", "relationship", "dating", "love"],
  lifestyle: ["food", "cafe", "restaurant", "gym", "fitness", "health", "sleep", "morning", "weekend", "travel"],
  academic: ["research", "paper", "thesis", "degree", "master", "phd", "professor", "department", "faculty", "university"],
} as const;

export function classifyContentCategory(text: string): string {
  const lower = text.toLowerCase();
  let bestCategory = "general";
  let bestScore = 0;

  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS_MAP)) {
    let score = 0;
    for (const word of words) {
      if (lower.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

export function computeKeywordScore(text: string, interests: UserInterests): number {
  if (interests.keywords.size === 0) return 0.5;

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 2);
  let maxMatch = 0;

  for (const [keyword, weight] of interests.keywords) {
    if (lower.includes(keyword)) {
      maxMatch = Math.max(maxMatch, weight);
    }
  }

  for (const word of words) {
    for (const [keyword, weight] of interests.keywords) {
      if (keyword.includes(word) || word.includes(keyword)) {
        maxMatch = Math.max(maxMatch, weight * 0.7);
      }
    }
  }

  return Math.min(1, 0.3 + 0.7 * maxMatch);
}
