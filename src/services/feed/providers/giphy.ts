import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate, shuffle } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SEARCH_QUERIES = [
  // Campus & College Life
  "college campus",
  "university student",
  "dorm life",
  "college party",
  "student life",
  "exam stress",
  "study fail",
  "final exams",
  "graduation",
  "back to school",
  // Funny & Memes
  "funny meme", "hilarious reaction", "lol video", "dank meme", "comedy fail",
  "funny", "lol", "meme", "fail", "funny animal",
  "laugh", "comedy", "hilarious", "rofl", "silly",
  "funny cat", "funny dog", "prank", "goofy", "cringe",
  "reaction", "mind blown", "celebration", "relatable", "literally me",
  "me irl", "when", "bruh", "im dead", "im crying",
  // Trending & Music
  "viral dance trend", "trending music", "dance challenge", "trending reels", "viral video",
  "viral", "trending", "popular", "dance", "vibes",
  "party hype", "hyped crowd",
];

type GiphyState = {
  searchIndex: number;
  searchOffset: number;
  searchDone: boolean;
};

const INITIAL_STATE: GiphyState = {
  searchIndex: 0,
  searchOffset: 0,
  searchDone: false,
};

export class GiphyProvider implements IFeedProvider {
  readonly id = "giphy";
  readonly displayName = "Giphy";
  private state: GiphyState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    try {
      // Randomize on a fresh query (offset 0); paginating keeps the same index
      // so the GIPHY offset chain stays valid within the current query.
      if (this.state.searchOffset === 0) {
        this.state = { ...this.state, searchIndex: Math.floor(Math.random() * SEARCH_QUERIES.length) };
      }
      const query = SEARCH_QUERIES[this.state.searchIndex % SEARCH_QUERIES.length];
      const data = await feedProxy("giphy", {
        type: "search",
        q: query,
        offset: String(this.state.searchOffset),
        limit: String(Math.min(ctx.pageSize, 10)),
      }, ctx.signal);
      if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

      const gifs = data.data ?? [];
      const total = data.pagination?.total_count ?? 0;
      const nextOffset = this.state.searchOffset + gifs.length;
      const nextIdx = nextOffset >= total ? (this.state.searchIndex + 1) % SEARCH_QUERIES.length : this.state.searchIndex;
      const resetOffset = nextOffset >= total ? 0 : nextOffset;

      const nextState: GiphyState = {
        searchIndex: nextIdx,
        searchOffset: resetOffset,
        searchDone: false,
      };
      this.state = nextState;

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      return { rawItems: gifs, nextPageState: nextState, hasMore: true, budgetCost: 1 };
    } catch {
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      const nextIdx = (this.state.searchIndex + 1) % SEARCH_QUERIES.length;
      this.state = { searchIndex: nextIdx, searchOffset: 0, searchDone: false };
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return shuffle(
      (raw as any[])
        .filter((g) => g?.id && g?.images?.original?.url)
        .map((g) => {
          const item: FeedItem = {
            id: `giphy-${g.id}`,
            source: "giphy",
            type: "gif",
            author: {
              name: g.user?.display_name || "Giphy",
              handle: null,
              avatarUrl: g.user?.avatar_url ?? null,
              profileUrl: g.user?.profile_url ?? null,
              verified: false,
            },
            content: {
              title: (g.title ?? "GIF").slice(0, 80),
              body: g.alt_text ?? null,
              bodyHtml: null,
              language: null,
            },
            media: [
              {
                url: g.images.original.url,
                type: "gif",
                width: parseInt(g.images.original.width ?? "0") || null,
                height: parseInt(g.images.original.height ?? "0") || null,
                thumbnailUrl: g.images.fixed_height_small?.url ?? null,
                videoId: null,
                videoUrl: g.images.original.mp4 ?? null,
                duration: null,
                alt: g.alt_text ?? null,
              },
            ],
            urls: { original: g.url ?? null, canonical: null, domain: "giphy.com" },
            timestamps: {
              publishedAt: safeDate(g.import_datetime),
              fetchedAt,
              expiresAt: null,
            },
            engagement: { likeCount: null, commentCount: null, shareCount: null, viewCount: null, userLiked: null },
            scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
            diversitySlot: "gif",
            contentCategory: "memes" as const,
            dedup: { nativeId: g.id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
            meta: {},
          };
          computeDedupKeys(item);
          return item;
        })
    );
  }

  cachePrefix(): string { return "giphy_v5"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 5000, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
