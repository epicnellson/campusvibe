import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SEARCH_QUERIES = [
  "university education campus",
  "study students college",
  "coding programming tutorial",
  "science research academic",
  "technology artificial intelligence",
  "scholarship internship career",
  "graduation commencement",
  "campus life student activities",
  "online learning education",
  "academic paper journal",
];

const SUPPORTED_LANGUAGES = new Set(["en"]);

type MastodonState = {
  queryIndex: number;
  maxId: string | null;
  done: boolean;
  pagesForQuery: number;
};

const INITIAL_STATE: MastodonState = { queryIndex: 0, maxId: null, done: false, pagesForQuery: 0 };

export class MastodonProvider implements IFeedProvider {
  readonly id = "mastodon";
  readonly displayName = "Mastodon";
  private state: MastodonState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    if (this.state.done) return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };

    try {
      const query = SEARCH_QUERIES[this.state.queryIndex % SEARCH_QUERIES.length];
      const data = await feedProxy("mastodon", {
        q: query,
        limit: "20",
        max_id: this.state.maxId ?? "",
      }, ctx.signal);
      if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

      const statuses = data.statuses ?? [];
      const lastId = statuses.length > 0 ? statuses[statuses.length - 1]?.id : null;
      const pagesForQuery = this.state.pagesForQuery + 1;

      let nextState: MastodonState;
      if (statuses.length === 0 || pagesForQuery >= 3) {
        const nextIdx = this.state.queryIndex + 1;
        nextState = nextIdx >= SEARCH_QUERIES.length
          ? { queryIndex: this.state.queryIndex, maxId: null, done: true, pagesForQuery: 0 }
          : { queryIndex: nextIdx, maxId: null, done: false, pagesForQuery: 0 };
      } else {
        nextState = { ...this.state, maxId: lastId || this.state.maxId, pagesForQuery };
      }

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      this.state = nextState;
      return { rawItems: statuses, nextPageState: nextState, hasMore: statuses.length > 0 && !nextState.done, budgetCost: 1 };
    } catch {
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
      this.state = { queryIndex: nextIdx, maxId: null, done: false, pagesForQuery: 0 };
      return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return (raw as any[])
      .filter((s) => {
        if (!s?.id) return false;
        const text = stripHtml(s.content ?? "");
        if (text.trim().length < 5) return false;
        if (s.sensitive) return false;
        const lang = s.language;
        if (lang && !SUPPORTED_LANGUAGES.has(lang)) return false;
        if (!s.account?.acct) return false;
        return true;
      })
      .map((s) => {
        const imageUrl = s.media_attachments?.[0]?.preview_url || s.media_attachments?.[0]?.url || null;
        const hasVideo = s.media_attachments?.some((m: any) => m.type === "video" || m.type === "gifv");
        const description = stripHtml(s.content ?? "").slice(0, 600);
        const mediaType = s.media_attachments?.[0]?.type;
        const videoUrl = (mediaType === "video" || mediaType === "gifv")
          ? (s.media_attachments[0]?.url ?? null)
          : null;

        const item: FeedItem = {
          id: `mastodon-${s.id}`,
          source: "mastodon",
          type: hasVideo ? "video" : imageUrl ? "image" : "text",
          author: {
            name: s.account?.display_name?.trim() || s.account?.acct || "Mastodon",
            handle: `@${s.account?.acct ?? ""}`,
            avatarUrl: s.account?.avatar ?? null,
            profileUrl: s.account?.url ?? null,
            verified: false,
          },
          content: {
            title: description.slice(0, 80) || "Mastodon post",
            body: description,
            bodyHtml: s.content ?? null,
            language: s.language ?? null,
          },
          media: imageUrl
            ? [{
                url: hasVideo ? (videoUrl ?? imageUrl) : imageUrl,
                type: hasVideo ? "video" : "image",
                width: s.media_attachments?.[0]?.meta?.original?.width ?? null,
                height: s.media_attachments?.[0]?.meta?.original?.height ?? null,
                thumbnailUrl: s.media_attachments?.[0]?.preview_url ?? null,
                videoId: null,
                videoUrl,
                duration: s.media_attachments?.[0]?.meta?.original?.duration ?? null,
                alt: s.media_attachments?.[0]?.description ?? null,
              }]
            : [],
          urls: { original: s.url ?? null, canonical: null, domain: "mastodon.social" },
          timestamps: {
            publishedAt: safeDate(s.created_at),
            fetchedAt,
            expiresAt: null,
          },
          engagement: {
            likeCount: s.favourites_count ?? 0,
            commentCount: s.replies_count ?? 0,
            shareCount: s.reblogs_count ?? 0,
            viewCount: null,
            userLiked: null,
          },
          scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
          diversitySlot: hasVideo ? "social_video" : imageUrl ? "social_image" : "social_text",
          contentCategory: "general" as const,
          dedup: { nativeId: s.id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
          meta: { language: s.language ?? null },
        };
        computeDedupKeys(item);
        return item;
      });
  }

  cachePrefix(): string { return "mastodon_v4"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 300, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#039;/g, "'");
}
