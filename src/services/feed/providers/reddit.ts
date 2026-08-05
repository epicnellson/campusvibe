import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate, shuffle } from "../normalize";
import { feedProxy } from "@/services/feed-proxy";

const SUBREDDITS = [
  // Campus & College Life
  "college",
  "collegememes",
  "CollegeRant",
  "students",
  "dorm",
  "university",
  "bookshelf",
  "StudentLife",
  // Funny & Memes
  "funny",
  "funnyvideos",
  "dankmemes",
  "memes",
  "unexpected",
  "wholesomememes",
  "mildlyinteresting",
  // Trending & Music
  "videos",
  "dancing",
  "funnycharts",
  "perfectlycutscreams",
  "CrazyFuckingVideos",
];

type RedditState = {
  subredditIndex: number;
  after: string | null;
  pagesForSubreddit: number;
  done: boolean;
};

const INITIAL_STATE: RedditState = { subredditIndex: 0, after: null, pagesForSubreddit: 0, done: false };

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isRichMediaPost(post: any): boolean {
  if (!post?.id) return false;
  if (post.over_18) return false;
  if (post.stickied) return false;
  if (post.spoiler) return false;
  if (post.removed_by_category || post.removed_by) return false;
  if (post.is_video) return false;
  if (post.preview?.images?.length) return true;
  if (post.is_gallery && post.media_metadata) return true;
  if (post.url && /\.(jpe?g|png|gifv?|webp)(\?|$)/i.test(post.url)) return true;
  return false;
}

export class RedditProvider implements IFeedProvider {
  readonly id = "reddit";
  readonly displayName = "Reddit";
  private state: RedditState = { ...INITIAL_STATE };
  private health: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    if (this.state.done) return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };

    try {
      // Randomize on a fresh subreddit (no `after` cursor in flight); paginating
      // within a subreddit keeps the same index so the listing cursor stays valid.
      if (!this.state.after) {
        this.state = { ...this.state, subredditIndex: Math.floor(Math.random() * SUBREDDITS.length) };
      }
      const subreddit = SUBREDDITS[this.state.subredditIndex % SUBREDDITS.length];
      const data = await feedProxy("reddit", {
        subreddit,
        limit: String(Math.min(ctx.pageSize, 25)),
        after: this.state.after ?? "",
      }, ctx.signal);
      if (data._skipped) return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0, _skipped: true };

      const children = data.data?.children ?? [];
      const nextAfter = data.data?.after ?? null;
      const pagesForSubreddit = this.state.pagesForSubreddit + 1;

      let nextState: RedditState;
      if (children.length === 0 || !nextAfter || pagesForSubreddit >= 2) {
        const nextIdx = this.state.subredditIndex + 1;
        nextState = nextIdx >= SUBREDDITS.length
          ? { subredditIndex: 0, after: null, pagesForSubreddit: 0, done: true }
          : { subredditIndex: nextIdx, after: null, pagesForSubreddit: 0, done: false };
      } else {
        nextState = { ...this.state, after: nextAfter, pagesForSubreddit };
      }
      this.state = nextState;

      this.health = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      return { rawItems: children, nextPageState: nextState, hasMore: !nextState.done, budgetCost: 1 };
    } catch {
      this.health = {
        state: this.health.consecutiveFailures >= 2 ? "broken" : "degraded",
        consecutiveFailures: this.health.consecutiveFailures + 1,
        lastSuccess: this.health.lastSuccess,
        lastFailure: new Date(),
        cooldownUntil: this.health.consecutiveFailures >= 2 ? new Date(Date.now() + 60_000) : null,
      };
      const nextIdx = this.state.subredditIndex + 1;
      if (nextIdx >= SUBREDDITS.length) {
        this.state = { ...this.state, done: true };
        return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
      }
      this.state = { subredditIndex: nextIdx, after: null, pagesForSubreddit: 0, done: false };
      return { rawItems: [], nextPageState: this.state, hasMore: true, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    return shuffle(
      (raw as any[])
        .filter((child) => child?.data)
        .map((child) => child.data)
        .filter(isRichMediaPost)
        .map((post) => {
          const previewSource = post.preview?.images?.[0]?.source?.url
            ? unescapeHtml(post.preview.images[0].source.url)
            : null;
          const directUrl = typeof post.url === "string" ? post.url : "";
          const id = String(post.id);

          let type: "image" | "gif" = "image";
          let mediaUrl = previewSource ?? directUrl;

          if (!previewSource) {
            if (/\.gifv(\?|$)/i.test(directUrl)) return null;
            if (/\.gif(\?|$)/i.test(directUrl)) {
              type = "gif";
              mediaUrl = directUrl;
            } else if (/\.(jpe?g|png|webp)(\?|$)/i.test(directUrl)) {
              mediaUrl = directUrl;
            } else {
              return null;
            }
          } else if (/\.gif(\?|$)/i.test(directUrl)) {
            type = "gif";
            mediaUrl = directUrl;
          }

          const thumbnail = post.thumbnail && /^https?:/i.test(post.thumbnail) ? post.thumbnail : null;
          const publishedAt = post.created_utc ? safeDate(new Date(post.created_utc * 1000)) : null;

          const item: FeedItem = {
            id: `reddit-${id}`,
            source: "reddit",
            type,
            author: {
              name: post.author || "Reddit",
              handle: post.author ? `u/${post.author}` : null,
              avatarUrl: null,
              profileUrl: post.author ? `https://www.reddit.com/user/${post.author}` : null,
              verified: false,
            },
            content: {
              title: (post.title ?? "Reddit post").slice(0, 200),
              body: post.selftext ? post.selftext.slice(0, 600) : null,
              bodyHtml: null,
              language: null,
            },
            media: [{
              url: mediaUrl,
              type,
              width: post.preview?.images?.[0]?.source?.width ?? null,
              height: post.preview?.images?.[0]?.source?.height ?? null,
              thumbnailUrl: thumbnail ?? previewSource,
              videoId: null,
              videoUrl: null,
              duration: null,
              alt: post.title ?? null,
            }],
            urls: {
              original: post.permalink ? `https://www.reddit.com${post.permalink}` : null,
              canonical: null,
              domain: "reddit.com",
            },
            timestamps: { publishedAt, fetchedAt, expiresAt: null },
            engagement: {
              likeCount: post.ups ?? null,
              commentCount: post.num_comments ?? null,
              shareCount: null,
              viewCount: null,
              userLiked: null,
            },
            scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
            diversitySlot: type === "gif" ? "gif" : "photo",
            contentCategory: "memes" as const,
            dedup: { nativeId: id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
            meta: { subreddit: post.subreddit ?? null, score: post.score ?? null },
          };
          computeDedupKeys(item);
          return item;
        })
        .filter((i): i is FeedItem => i !== null)
    );
  }

  cachePrefix(): string { return "reddit_v1"; }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 200, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> { return this.health; }

  resetState(): void {
    this.state = { ...INITIAL_STATE };
  }
}
