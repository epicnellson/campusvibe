import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate, shuffle } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const QUERIES = [
  "funny animals",
  "humor",
  "funny face",
  "comedy",
  "funny expressions",
];

const ORIENTATIONS = ["landscape", "portrait", "squarish"] as const;

type UnsplashState = {
  queryIndex: number;
  page: number;
  orientationIndex: number;
  pagesForQuery: number;
  done: boolean;
};

const INITIAL_STATE: UnsplashState = { queryIndex: 0, page: 1, orientationIndex: 0, pagesForQuery: 0, done: false };

export class UnsplashProvider implements IFeedProvider {
  readonly id = "unsplash";
  readonly displayName = "Unsplash";
  private state: UnsplashState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    try {
      const query = QUERIES[this.state.queryIndex % QUERIES.length];
      const orientation = ORIENTATIONS[this.state.orientationIndex % ORIENTATIONS.length];
      const data = await feedProxy("unsplash", {
        q: query,
        page: String(this.state.page),
        perPage: String(ctx.pageSize),
        orientation,
      }, ctx.signal);
      if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

      const results = data.results ?? [];
      const total = data.total ?? 0;
      const pagesForQuery = this.state.pagesForQuery + 1;
      const maxPagesPerQuery = 2;

      let nextState: UnsplashState;
      if (results.length === 0 || pagesForQuery >= maxPagesPerQuery || this.state.page * 10 >= total) {
        const nextQueryIdx = (this.state.queryIndex + 1) % QUERIES.length;
        const nextOrientIdx = (this.state.orientationIndex + 1) % ORIENTATIONS.length;
        nextState = { queryIndex: nextQueryIdx, page: 1, orientationIndex: nextOrientIdx, pagesForQuery: 0, done: false };
      } else {
        nextState = { ...this.state, page: this.state.page + 1, pagesForQuery };
      }

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      this.state = nextState;
      return { rawItems: results, nextPageState: nextState, hasMore: results.length > 0, budgetCost: 1 };
    } catch {
      const nextIdx = (this.state.queryIndex + 1) % QUERIES.length;
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      this.state = { ...this.state, queryIndex: nextIdx, page: 1, pagesForQuery: 0, done: false };
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return shuffle(
      (raw as any[])
      .filter((p) => p?.id && p?.urls?.regular)
      .map((p) => {
        const item: FeedItem = {
          id: `unsplash-${p.id}`,
          source: "unsplash",
          type: "image",
          author: {
            name: p.user?.name ?? "Unsplash",
            handle: p.user?.username ?? null,
            avatarUrl: p.user?.profile_image?.small ?? null,
            profileUrl: p.links?.html ?? null,
            verified: false,
          },
          content: {
            title: p.alt_description ?? "Humor photo",
            body: p.description ?? p.alt_description ?? null,
            bodyHtml: null,
            language: null,
          },
          media: [
            {
              url: p.urls.regular,
              type: "image",
              width: p.width ?? null,
              height: p.height ?? null,
              thumbnailUrl: p.urls?.thumb ?? null,
              videoId: null,
              videoUrl: null,
              duration: null,
              alt: p.alt_description ?? null,
            },
          ],
          urls: { original: p.links?.html ?? null, canonical: null, domain: "unsplash.com" },
          timestamps: {
            publishedAt: safeDate(p.created_at),
            fetchedAt,
            expiresAt: null,
          },
          engagement: { likeCount: null, commentCount: null, shareCount: null, viewCount: null, userLiked: null },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: "photo",
          contentCategory: "memes" as const,
          dedup: { nativeId: p.id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
          meta: { orientation: p.orientation ?? null, likes: p.likes ?? null },
        };
        computeDedupKeys(item);
        return item;
      })
    );
  }

  cachePrefix(): string { return "unsplash_v5"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 200, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
