import { Platform } from "react-native";
import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, stripHtml, safeDate, shuffle } from "../normalize";
import { feedProxy } from "../../feed-proxy";

const SEARCH_QUERIES = [
  "funny", "jokes", "memes", "lol",
  "comedy", "humor", "hilarious", "funny memes",
  "dad jokes", "meme", "funny stories", "rofl",
];

const SUPPORTED_LANGUAGES = new Set(["en", "und"]);

type BlueskyState = {
  queryIndex: number;
  cursor: string | null;
  done: boolean;
};

const INITIAL_STATE: BlueskyState = { queryIndex: 0, cursor: null, done: false };

export class BlueskyProvider implements IFeedProvider {
  readonly id = "bluesky";
  readonly displayName = "Bluesky";
  private state: BlueskyState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    if (this.state.done) return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);

    try {
      const query = SEARCH_QUERIES[this.state.queryIndex % SEARCH_QUERIES.length];
      const params = new URLSearchParams({ q: query, limit: "15" });
      if (this.state.cursor) params.set("cursor", this.state.cursor);

      let data: any;
      if (Platform.OS === "web") {
        data = await feedProxy("bluesky", { q: query, limit: "15", cursor: this.state.cursor ?? "" }, ctx.signal);
      } else {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (!res.ok) {
          const nextIdx = this.state.queryIndex + 1;
          if (nextIdx >= SEARCH_QUERIES.length) {
            this.state = { ...this.state, done: true };
            this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
            return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
          }
          this.state = { queryIndex: nextIdx, cursor: null, done: false };
          return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
        }
        data = await res.json();
      }
      const posts = data.posts ?? [];
      const nextCursor = data.cursor ?? null;

      let nextState: BlueskyState;
      if (!nextCursor) {
        const nextIdx = this.state.queryIndex + 1;
        nextState = nextIdx >= SEARCH_QUERIES.length
          ? { queryIndex: this.state.queryIndex, cursor: null, done: true }
          : { queryIndex: nextIdx, cursor: null, done: false };
      } else {
        nextState = { ...this.state, cursor: nextCursor };
      }
      this.state = nextState;

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      return { rawItems: posts, nextPageState: nextState, hasMore: !!nextCursor || nextState.queryIndex !== this.state.queryIndex, budgetCost: 0 };
    } catch {
      clearTimeout(timer);
      const nextIdx = this.state.queryIndex + 1;
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      if (nextIdx >= SEARCH_QUERIES.length) {
        this.state = { ...this.state, done: true };
        return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
      }
      this.state = { queryIndex: nextIdx, cursor: null, done: false };
      return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return shuffle(
      (raw as any[])
      .filter((p) => {
        const text = p?.record?.text;
        if (!text || typeof text !== "string" || text.trim().length === 0) return false;
        const lang = p.record?.langs?.[0];
        if (lang && !SUPPORTED_LANGUAGES.has(lang)) return false;
        if (!p.author?.handle) return false;
        return true;
      })
      .map((p) => {
        const images = p.embed?.images ?? [];
        const hasVideo = !!p.embed?.video;
        const text = p.record?.text ?? "";
        const description = stripHtml(text).slice(0, 600);
        const imageUrl = images[0]?.fullsize ?? null;
        const langs: string[] = p.record?.langs ?? [];

        const item: FeedItem = {
          id: `bsky-${p.uri}`,
          source: "bluesky",
          type: hasVideo ? "video" : imageUrl ? "image" : "text",
          author: {
            name: p.author?.displayName ?? "Bluesky",
            handle: p.author?.handle ? `@${p.author.handle}` : null,
            avatarUrl: p.author?.avatar ?? null,
            profileUrl: p.author?.handle ? `https://bsky.app/profile/${p.author.handle}` : null,
            verified: false,
          },
          content: {
            title: description.slice(0, 80) || "Bluesky post",
            body: description,
            bodyHtml: null,
            language: langs[0] ?? null,
          },
          media: imageUrl
            ? [{
                url: imageUrl,
                type: hasVideo ? "video" : "image",
                width: images[0]?.aspectRatio?.width ?? null,
                height: images[0]?.aspectRatio?.height ?? null,
                thumbnailUrl: images[0]?.thumb ?? null,
                videoId: null,
                videoUrl: null,
                duration: null,
                alt: images[0]?.alt ?? null,
              }]
            : [],
          urls: { original: p.uri ?? null, canonical: null, domain: "bsky.app" },
          timestamps: {
            publishedAt: safeDate(p.indexedAt),
            fetchedAt,
            expiresAt: null,
          },
          engagement: {
            likeCount: p.likeCount ?? 0,
            commentCount: p.replyCount ?? 0,
            shareCount: p.repostCount ?? 0,
            viewCount: null,
            userLiked: null,
          },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: hasVideo ? "social_video" : imageUrl ? "social_image" : "social_text",
          contentCategory: "memes" as const,
          dedup: { nativeId: p.uri, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
          meta: { language: langs[0] ?? null },
        };
        computeDedupKeys(item);
        return item;
      })
    );
  }

  cachePrefix(): string { return "bsky_v3"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 500, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
