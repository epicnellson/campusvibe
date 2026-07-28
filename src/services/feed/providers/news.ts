import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SEARCH_QUERIES = [
  "funny college stories viral",
  "funny student moments university",
  "college prank goes wrong",
  "university challenge funny students",
  "viral campus video trending",
  "funny exam reaction students",
  "college roommate drama funny",
  "funny graduation ceremony moments",
  "student dorm life hilarious",
  "funny professor lecture moment",
  "college group project fails",
  "university talent show funny",
  "funny campus adventure",
  "student comedy skit viral",
  "college party funny moments",
  "funny study group session",
  "university sports blooper",
  "college cafeteria funny",
  "student union comedy",
  "campus tour funny moments",
  "college life memes trending",
  "funny international students",
  "university debate funny",
  "college theater performance",
  "student hackathon funny",
  "campus music performance viral",
  "college fashion show funny",
  "university science experiment funny",
  "student volunteer funny moments",
  "college reunion funny stories",
];

type NewsState = {
  queryIndex: number;
  page: number;
  done: boolean;
  pagesForQuery: number;
};

const INITIAL_STATE: NewsState = { queryIndex: 0, page: 1, done: false, pagesForQuery: 0 };

export class NewsProvider implements IFeedProvider {
  readonly id = "news";
  readonly displayName = "News";
  private state: NewsState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    try {
      const query = SEARCH_QUERIES[this.state.queryIndex % SEARCH_QUERIES.length];
      const data = await feedProxy("news", {
        q: query,
        page: String(this.state.page),
        pageSize: String(ctx.pageSize),
      }, ctx.signal);
      if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

      const articles = (data.articles ?? []).filter(
        (a: any) => a.title && a.title !== "[Removed]" && a.title.length > 5
      );
      const totalResults = data.totalResults ?? 0;
      const pagesForQuery = this.state.pagesForQuery + 1;
      const maxPagesForQuery = 3;

      let nextState: NewsState;
      if (articles.length === 0 || pagesForQuery >= maxPagesForQuery || this.state.page * ctx.pageSize >= totalResults) {
        const nextIdx = (this.state.queryIndex + 1) % SEARCH_QUERIES.length;
        nextState = { queryIndex: nextIdx, page: 1, done: false, pagesForQuery: 0 };
      } else {
        nextState = { ...this.state, page: this.state.page + 1, pagesForQuery };
      }

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      this.state = nextState;
      return { rawItems: articles, nextPageState: nextState, hasMore: articles.length > 0, budgetCost: 1 };
    } catch {
      const nextIdx = (this.state.queryIndex + 1) % SEARCH_QUERIES.length;
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      this.state = { queryIndex: nextIdx, page: 1, done: false, pagesForQuery: 0 };
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return (raw as any[])
      .filter((a) => {
        if (!a?.url || !a?.title) return false;
        if (a.title === "[Removed]") return false;
        const desc = a.description ?? "";
        if (desc.length < 10 && !a.urlToImage) return false;
        return true;
      })
      .map((a, i) => {
        const url = a.url as string;
        const item: FeedItem = {
          id: `news-${btoa(url).slice(0, 20)}-${i}`,
          source: "news",
          type: "article",
          author: {
            name: a.author ?? a.source?.name ?? "News",
            handle: null,
            avatarUrl: null,
            profileUrl: null,
            verified: false,
          },
          content: {
            title: a.title,
            body: a.description?.slice(0, 600) ?? null,
            bodyHtml: null,
            language: "en",
          },
          media: a.urlToImage
            ? [{
                url: a.urlToImage,
                type: "image" as const,
                width: null,
                height: null,
                thumbnailUrl: a.urlToImage,
                videoId: null,
                videoUrl: null,
                duration: null,
                alt: a.title ?? null,
              }]
            : [],
          urls: { original: url, canonical: null, domain: null },
          timestamps: {
            publishedAt: safeDate(a.publishedAt),
            fetchedAt,
            expiresAt: null,
          },
          engagement: { likeCount: null, commentCount: null, shareCount: null, viewCount: null, userLiked: null },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: "news",
          contentCategory: "news" as const,
          dedup: { nativeId: url, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
          meta: { sourceName: a.source?.name ?? "News" },
        };
        computeDedupKeys(item);
        return item;
      });
  }

  cachePrefix(): string { return "news_v5"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 500, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
