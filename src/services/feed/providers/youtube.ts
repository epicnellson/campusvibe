import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate, shuffle } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SEARCH_QUERIES = [
  // Campus & College Life
  "college campus life",
  "university student comedy",
  "dorm room hacks",
  "college sports highlights",
  "college life vlog",
  "day in the life university",
  "college dorm tour",
  "university freshmen experience",
  "student club activities",
  "campus events",
  // Funny & Memes
  "funny short clips",
  "relatable comedy shorts",
  "viral meme video",
  "try not to laugh",
  "funny fails compilation",
  "funny animals",
  "comedy skit",
  "funny prank",
  "dank memes",
  "funny moments",
  "viral funny videos",
  "unexpected funny",
  "funny vines",
  "hilarious reactions",
  "funny memes compilation",
  "funny pets",
  "practical jokes",
  "best funny moments",
  "funny bloopers",
  "roast battle",
  "standup comedy clip",
  "funny challenge",
  // Trending & Music
  "trending music shorts",
  "viral dance trend",
  "top trending reels",
  "trending dance challenge",
  "popular music video short",
  "viral challenge",
  "trending prank video",
];

type YouTubeState = {
  mode: "popular" | "search";
  popularPageToken: string;
  popularDone: boolean;
  searchIndex: number;
  searchPageToken: string;
  searchDone: boolean;
};

const INITIAL_STATE: YouTubeState = {
  mode: "search",
  popularPageToken: "",
  popularDone: true,
  searchIndex: 0,
  searchPageToken: "",
  searchDone: false,
};

export class YouTubeProvider implements IFeedProvider {
  readonly id = "youtube";
  readonly displayName = "YouTube";
  private state: YouTubeState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    try {
      if (this.state.mode === "popular" && !this.state.popularDone) {
        const data = await feedProxy("youtube", {
          type: "popular",
          pageSize: String(ctx.pageSize),
          pageToken: this.state.popularPageToken,
        }, ctx.signal);
        if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

        const items = data.items ?? [];
        const nextState: YouTubeState = {
          ...this.state,
          popularPageToken: data.nextPageToken ?? "",
          popularDone: !data.nextPageToken,
        };
        this.state = nextState;

        this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
        return { rawItems: items, nextPageState: nextState, hasMore: !nextState.popularDone || true, budgetCost: 1 };
      }

      if (this.state.mode === "search" || this.state.popularDone) {
        // Randomize the query whenever we're starting a fresh search (no page
        // token in flight); paginating within a query keeps the same index so
        // nextPageToken chains stay valid.
        if (!this.state.searchPageToken) {
          this.state = { ...this.state, searchIndex: Math.floor(Math.random() * SEARCH_QUERIES.length) };
        }
        const query = SEARCH_QUERIES[this.state.searchIndex % SEARCH_QUERIES.length];
        const data = await feedProxy("youtube", {
          type: "search",
          q: query,
          relevanceLanguage: "en",
          pageSize: String(Math.min(ctx.pageSize, 10)),
          pageToken: this.state.searchPageToken,
        }, ctx.signal);
        if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

        const items = data.items ?? [];
        const nextToken = data.nextPageToken ?? "";
        const nextIdx = nextToken ? this.state.searchIndex : this.state.searchIndex + 1;

        const nextState: YouTubeState = {
          ...this.state,
          mode: "search",
          popularDone: true,
          searchIndex: nextIdx >= SEARCH_QUERIES.length ? 0 : nextIdx,
          searchPageToken: nextToken,
          searchDone: false,
        };
        this.state = nextState;

        this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
        return { rawItems: items, nextPageState: nextState, hasMore: true, budgetCost: 1 };
      }

      const switchState = { ...this.state, mode: "search" as const };
      this.state = switchState;
      return { rawItems: [], nextPageState: switchState, hasMore: true, budgetCost: 0 };
    } catch {
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      if (this.health.state === "broken") {
        const nextIdx = (this.state.searchIndex + 1) % SEARCH_QUERIES.length;
        this.state = { ...this.state, mode: "search", popularDone: true, searchIndex: nextIdx, searchPageToken: "", searchDone: false };
      }
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return shuffle(
      (raw as any[])
      .filter((v) => v?.id && v?.snippet?.title)
      .map((v) => {
        const id = typeof v.id === "string" ? v.id : v.id?.videoId ?? "";
        if (!id) return null;
        const item: FeedItem = {
          id: `yt-${id}`,
          source: "youtube",
          type: "video",
          author: {
            name: v.snippet?.channelTitle ?? "YouTube",
            handle: null,
            avatarUrl: null,
            profileUrl: v.snippet?.channelId ? `https://youtube.com/channel/${v.snippet.channelId}` : null,
            verified: false,
          },
          content: {
            title: v.snippet?.title ?? "Video",
            body: v.snippet?.description?.slice(0, 500) ?? null,
            bodyHtml: null,
            language: v.snippet?.defaultLanguage ?? null,
          },
          media: [
            {
              url: v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.medium?.url ?? "",
              type: "video",
              width: 480,
              height: 360,
              thumbnailUrl: v.snippet?.thumbnails?.medium?.url ?? null,
              videoId: id,
              videoUrl: `https://youtube.com/watch?v=${id}`,
              duration: null,
              alt: v.snippet?.title ?? null,
            },
          ],
          urls: {
            original: `https://youtube.com/watch?v=${id}`,
            canonical: null,
            domain: "youtube.com",
          },
          timestamps: {
            publishedAt: safeDate(v.snippet?.publishedAt),
            fetchedAt,
            expiresAt: null,
          },
          engagement: {
            likeCount: v.statistics?.likeCount ? parseInt(v.statistics.likeCount) : null,
            commentCount: v.statistics?.commentCount ? parseInt(v.statistics.commentCount) : null,
            shareCount: null,
            viewCount: v.statistics?.viewCount ? parseInt(v.statistics.viewCount) : null,
            userLiked: null,
          },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: "video",
          contentCategory: "memes" as const,
          dedup: { nativeId: id, canonicalUrl: null, imageUrl: null, videoId: id, titleHash: 0, bodyHash: 0 },
          meta: { mode: this.state.mode },
        };
        computeDedupKeys(item);
        return item;
      })
      .filter(Boolean) as FeedItem[]
    );
  }

  cachePrefix(): string { return "yt_v5"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 10000, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
