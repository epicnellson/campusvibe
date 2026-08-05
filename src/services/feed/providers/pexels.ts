import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, shuffle } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const PHOTO_QUERIES = [
  "funny campus moments",
  "university students happy",
  "college friends fun",
  "student life aesthetic",
  "campus party celebration",
  "graduation joy students",
  "college study group",
  "university sports action",
  "student creative workspace",
  "campus nature beautiful",
  "college rooftop sunset",
  "student coffee shop",
  "university architecture",
  "college dance performance",
  "student art gallery",
  "campus rain aesthetic",
  "college autumn campus",
  "student yoga morning",
  "university concert",
  "college food festival",
];

const VIDEO_QUERIES = [
  // Campus & College Life
  "college campus life",
  "university student comedy",
  "dorm room",
  "college sports highlights",
  "campus party celebration",
  "student dorm hacks",
  "university events",
  // Funny & Memes
  "funny bloopers",
  "funny pets",
  "funny fail",
  "funny animals",
  "funny moments",
  "relatable comedy",
  "humor",
  "laughing people",
  // Trending & Music
  "dance trend",
  "trending music",
  "dance party",
  "viral dance",
  "music festival",
  "concert crowd",
];

type PexelsState = {
  mode: "photo" | "video";
  queryIndex: number;
  page: number;
  pagesForMode: number;
  done: boolean;
};

const INITIAL_STATE: PexelsState = { mode: "photo", queryIndex: 0, page: 1, pagesForMode: 0, done: false };

export class PexelsProvider implements IFeedProvider {
  readonly id = "pexels";
  readonly displayName = "Pexels";
  private state: PexelsState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    try {
      const queries = this.state.mode === "photo" ? PHOTO_QUERIES : VIDEO_QUERIES;
      // Randomize on the first page of a new query so every cold load / refresh
      // starts from a random seed; subsequent pages stay on the same query.
      if (this.state.page === 1 && this.state.pagesForMode === 0) {
        this.state = { ...this.state, queryIndex: Math.floor(Math.random() * queries.length) };
      }
      const query = queries[this.state.queryIndex % queries.length];

      const data = await feedProxy("pexels", {
        type: this.state.mode,
        q: query,
        page: String(this.state.page),
        perPage: String(ctx.pageSize),
      }, ctx.signal);
      if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

      const rawItems = this.state.mode === "photo" ? (data.photos ?? []) : (data.videos ?? []);
      const total = data.total_results ?? 0;
      const pagesForMode = this.state.pagesForMode + 1;
      const maxPagesPerMode = 2;

      let nextState: PexelsState;
      if (rawItems.length === 0 || pagesForMode >= maxPagesPerMode || this.state.page * 10 >= total) {
        const nextQueryIdx = Math.floor(Math.random() * queries.length);
        if (this.state.queryIndex + 1 >= queries.length) {
          if (this.state.mode === "photo") {
            nextState = { mode: "video", queryIndex: 0, page: 1, pagesForMode: 0, done: false };
          } else {
            nextState = { mode: "photo", queryIndex: 0, page: 1, pagesForMode: 0, done: false };
          }
        } else {
          nextState = { ...this.state, queryIndex: nextQueryIdx, page: 1, pagesForMode: 0 };
        }
      } else {
        nextState = { ...this.state, page: this.state.page + 1, pagesForMode };
      }

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      this.state = nextState;
      return { rawItems, nextPageState: nextState, hasMore: rawItems.length > 0, budgetCost: 1 };
    } catch {
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      const nextIdx = (this.state.queryIndex + 1) % 20;
      this.state = { ...this.state, queryIndex: nextIdx, page: 1, pagesForMode: 0, done: false };
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    const sample = raw[0] as any;
    const items =
      sample?.video_files?.length > 0
        ? this.normalizeVideos(raw, fetchedAt)
        : this.normalizePhotos(raw, fetchedAt);
    return shuffle(items);
  }

  private normalizePhotos(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return (raw as any[])
      .filter((p) => p?.id && (p.src?.large2x || p.src?.large))
      .map((p) => {
        const id = String(p.id);
        const item: FeedItem = {
          id: `pexels-photo-${id}`,
          source: "pexels",
          type: "image",
          author: {
            name: p.photographer ?? "Pexels",
            handle: null,
            avatarUrl: null,
            profileUrl: p.photographer_url ?? null,
            verified: false,
          },
          content: {
            title: (p.alt ?? "Campus photo").slice(0, 80),
            body: p.alt ?? null,
            bodyHtml: null,
            language: null,
          },
          media: [{
            url: p.src.large2x ?? p.src.large,
            type: "image",
            width: p.width ?? null,
            height: p.height ?? null,
            thumbnailUrl: p.src.medium ?? null,
            videoId: null,
            videoUrl: null,
            duration: null,
            alt: p.alt ?? null,
          }],
          urls: { original: p.url ?? null, canonical: null, domain: "pexels.com" },
          timestamps: { publishedAt: null, fetchedAt, expiresAt: null },
          engagement: { likeCount: null, commentCount: null, shareCount: null, viewCount: null, userLiked: null },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: "photo",
          contentCategory: "general" as const,
          dedup: { nativeId: id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
          meta: {},
        };
        computeDedupKeys(item);
        return item;
      });
  }

  private normalizeVideos(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return (raw as any[])
      .filter((v) => v?.id && v.video_files?.length > 0)
      .map((v) => {
        const id = String(v.id);
        const bestFile = v.video_files?.find((f: any) => f.width >= 1280 && f.file_type === "video/mp4")
          ?? v.video_files?.find((f: any) => f.width >= 720)
          ?? v.video_files?.[0];
        const item: FeedItem = {
          id: `pexels-video-${id}`,
          source: "pexels",
          type: "video",
          author: {
            name: v.user?.name ?? "Pexels",
            handle: null,
            avatarUrl: v.user?.avatar ?? null,
            profileUrl: null,
            verified: false,
          },
          content: {
            title: (v.url?.split("/").filter(Boolean).pop()?.replace(/-/g, " ") ?? "Video").slice(0, 80),
            body: null,
            bodyHtml: null,
            language: null,
          },
          media: [{
            url: bestFile?.link ?? v.url ?? "",
            type: "video",
            width: bestFile?.width ?? null,
            height: bestFile?.height ?? null,
            thumbnailUrl: v.video_pictures?.[0]?.picture ?? null,
            videoId: id,
            videoUrl: v.url ?? null,
            duration: v.duration ?? null,
            alt: null,
          }],
          urls: { original: v.url ?? null, canonical: null, domain: "pexels.com" },
          timestamps: { publishedAt: null, fetchedAt, expiresAt: null },
          engagement: { likeCount: null, commentCount: null, shareCount: null, viewCount: null, userLiked: null },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: "video",
          contentCategory: "general" as const,
          dedup: { nativeId: id, canonicalUrl: null, imageUrl: null, videoId: id, titleHash: 0, bodyHash: 0 },
          meta: { duration: v.duration ?? null },
        };
        computeDedupKeys(item);
        return item;
      });
  }

  cachePrefix(): string { return "pexels_v5"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 500, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
