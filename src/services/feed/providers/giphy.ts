import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SEARCH_QUERIES = [
  "funny", "lol", "meme", "fail", "funny animal",
  "laugh", "comedy", "hilarious", "rofl", "silly",
  "funny cat", "funny dog", "prank", "goofy", "wtf",
  "facepalm", "face palm", "awkward", "cringe", "no way",
  "shocked", "reaction", "mind blown", "omg", "omg wow",
  "celebration", "party", "dance", "vibes", "mood",
  "relatable", "literally me", "same", "me irl", "when",
  "bruh", "dead", "im dead", "im crying", "help",
  "viral", "trending", "popular", "best", "top",
  "anime", "cartoon", "animation", "stick figure", "drawn",
];

type GiphyState = {
  mode: "trending" | "search";
  trendingOffset: number;
  trendingDone: boolean;
  searchIndex: number;
  searchOffset: number;
  searchDone: boolean;
};

const INITIAL_STATE: GiphyState = {
  mode: "trending",
  trendingOffset: 0,
  trendingDone: false,
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
      if (this.state.mode === "trending" && !this.state.trendingDone) {
        const data = await feedProxy("giphy", {
          type: "trending",
          offset: String(this.state.trendingOffset),
          limit: String(ctx.pageSize),
        }, ctx.signal);
        if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

        const gifs = data.data ?? [];
        const total = data.pagination?.total_count ?? 0;
        const nextOffset = this.state.trendingOffset + gifs.length;

        const nextState: GiphyState = {
          ...this.state,
          trendingOffset: nextOffset,
          trendingDone: nextOffset >= total || gifs.length === 0,
        };
        this.state = nextState;

        this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
        return { rawItems: gifs, nextPageState: nextState, hasMore: !nextState.trendingDone, budgetCost: 1 };
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
        ...this.state,
        mode: "search",
        trendingDone: true,
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
      this.state = { ...this.state, mode: "search", trendingDone: true, searchIndex: nextIdx, searchOffset: 0, searchDone: false };
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return (raw as any[])
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
      });
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
