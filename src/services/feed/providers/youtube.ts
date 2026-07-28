import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SEARCH_QUERIES = [
  "funny college moments",
  "funny shorts",
  "funny study memes",
  "college comedy skit",
  "unexpected university moments",
  "relatable student problems",
  "funny student life vlog",
  "funny graduation fail",
  "college prank",
  "funny classroom moment",
  "university challenge funny",
  "student dorm life funny",
  "funny professor moment",
  "college exam struggle",
  "funny campus adventure",
  "viral college video",
  "funny group project",
  "student multitasking funny",
  "college motivation funny",
  "study with me ASMR",
  "satisfying study notes",
  "productive morning routine",
  "campus aesthetic vlog",
  "college day in my life",
  "university room tour",
  "student budget meals",
  "coding tutorial beginner",
  "productivity tips students",
  "campus tour university",
  "scholarship advice tips",
  "internship interview tips",
  "study abroad experience",
  "college roommate stories",
  "late night study session",
  "exam results reaction",
  "graduation ceremony emotional",
  "campus sunset beautiful",
  "university lab experiment",
  "student art project",
  "college dance performance",
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
  mode: "popular",
  popularPageToken: "",
  popularDone: false,
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
        const query = SEARCH_QUERIES[this.state.searchIndex % SEARCH_QUERIES.length];
        const data = await feedProxy("youtube", {
          type: "search",
          q: query,
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
    return (raw as any[])
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
          contentCategory: "general" as const,
          dedup: { nativeId: id, canonicalUrl: null, imageUrl: null, videoId: id, titleHash: 0, bodyHash: 0 },
          meta: { mode: this.state.mode },
        };
        computeDedupKeys(item);
        return item;
      })
      .filter(Boolean) as FeedItem[];
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
