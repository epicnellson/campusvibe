import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem } from "../types";
import { computeDedupKeys, safeDate } from "../normalize";

type CampusPageState = {
  postsCursor: any;
  eventsCursor: any;
  confessionsCursor: any;
  done: boolean;
};

export class CampusProvider implements IFeedProvider {
  readonly id = "campus";
  readonly displayName = "Campus Feed";

  private state: CampusPageState = { postsCursor: null, eventsCursor: null, confessionsCursor: null, done: false };
  private lastHealth: HealthStatus = { state: "healthy", consecutiveFailures: 0, lastSuccess: null, lastFailure: null, cooldownUntil: null };

  constructor(private userId?: string) {}

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    if (this.state.done) return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };

    try {
      const { db_ops } = await import("@/services/db");

      const PAGE_SIZE = 20;

      const postOpts: any = {
        orderBy: [{ field: "created_at", direction: "desc" as const }],
        limitCount: PAGE_SIZE,
      };
      if (this.state.postsCursor) postOpts.startAfterDoc = this.state.postsCursor;

      const confessionOpts: any = {
        orderBy: [{ field: "created_at", direction: "desc" as const }],
        limitCount: 10,
      };
      if (this.state.confessionsCursor) confessionOpts.startAfterDoc = this.state.confessionsCursor;

      const today = new Date().toISOString().split("T")[0];
      const eventOpts: any = {
        conditions: [{ field: "date", op: ">=" as const, value: today }],
        orderBy: [{ field: "date", direction: "asc" as const }],
        limitCount: 10,
      };
      if (this.state.eventsCursor) eventOpts.startAfterDoc = this.state.eventsCursor;

      const [postsRaw, confessionsRaw, eventsRaw] = await Promise.all([
        db_ops.query("posts", postOpts),
        db_ops.query("confessions", confessionOpts),
        db_ops.query("events", eventOpts),
      ]);

      const posts = (postsRaw ?? []).map((p: any) => ({ ...p, __collection: "posts" }));
      const confessions = (confessionsRaw ?? []).map((c: any) => ({ ...c, __collection: "confessions" }));
      const events = (eventsRaw ?? []).map((e: any) => ({ ...e, __collection: "events" }));

      const userIds = new Set<string>();
      for (const item of [...posts, ...confessions, ...events]) {
        if (item.user_id) userIds.add(item.user_id);
      }

      const profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const profileIds = [...userIds];
        const BATCH = 10;
        for (let i = 0; i < profileIds.length; i += BATCH) {
          const batch = profileIds.slice(i, i + BATCH);
          const profiles = await Promise.all(batch.map((id) => db_ops.get("profiles", id)));
          for (const p of profiles) {
            if (p) profileMap.set(p.id, p);
          }
        }
      }

      for (const item of [...posts, ...confessions, ...events]) {
        if (item.user_id && profileMap.has(item.user_id)) {
          item.profiles = profileMap.get(item.user_id);
        }
      }

      const allItems = [...posts, ...confessions, ...events];
      const hasMore = posts.length >= PAGE_SIZE || confessions.length >= 10 || events.length >= 10;

      this.state = {
        postsCursor: posts.length > 0 ? posts[posts.length - 1] : this.state.postsCursor,
        eventsCursor: events.length > 0 ? events[events.length - 1] : this.state.eventsCursor,
        confessionsCursor: confessions.length > 0 ? confessions[confessions.length - 1] : this.state.confessionsCursor,
        done: !hasMore,
      };

      this.lastHealth = { state: "healthy", consecutiveFailures: 0, lastSuccess: new Date(), lastFailure: null, cooldownUntil: null };
      return { rawItems: allItems, nextPageState: this.state, hasMore, budgetCost: 0 };
    } catch (e) {
      this.lastHealth.consecutiveFailures++;
      this.lastHealth.lastFailure = new Date();
      this.lastHealth.state = this.lastHealth.consecutiveFailures >= 3 ? "broken" : "degraded";
      return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };
    }
  }

  normalize(raw: unknown[], fetchedAt: Date): FeedItem[] {
    const items: FeedItem[] = [];

    for (const item of raw) {
      const r = item as Record<string, any>;
      const collection = r.__collection as string;
      const isEvent = collection === "events" || ("date" in r && "location" in r);
      const isConfession = collection === "confessions";
      const isPost = collection === "posts" || ("content" in r && "likes" in r && !isConfession);

      let type: FeedItem["type"];
      let diversitySlot: FeedItem["diversitySlot"];
      let body = "";
      let imageUrl: string | null = null;

      if (isEvent) {
        type = "event";
        diversitySlot = "campus_event";
        body = r.description ?? "";
        imageUrl = r.image_url ?? null;
      } else if (isConfession) {
        type = "text";
        diversitySlot = "campus_confession";
        body = r.content ?? "";
      } else if (isPost) {
        type = r.image_url ? "image" : "text";
        diversitySlot = "campus_post";
        body = r.content ?? "";
        imageUrl = r.image_url ?? null;
      } else {
        type = "text";
        diversitySlot = "campus_post";
        body = r.content ?? "";
      }

      const authorProfile = r.profiles;
      const feedItem: FeedItem = {
        id: `campus-${r.id}`,
        source: "campus",
        type,
        author: {
          name: isConfession ? "Anonymous" : (authorProfile?.name ?? "Unknown"),
          handle: isConfession ? null : null,
          avatarUrl: isConfession ? null : (authorProfile?.avatar_url ?? null),
          profileUrl: null,
          verified: false,
        },
        content: {
          title: isEvent ? (r.title ?? null) : null,
          body,
          bodyHtml: null,
          language: "en",
        },
        media: imageUrl
          ? [{ url: imageUrl, type: "image", width: null, height: null, thumbnailUrl: imageUrl, videoId: null, videoUrl: null, duration: null, alt: null }]
          : [],
        urls: { original: null, canonical: null, domain: null },
        timestamps: {
          publishedAt: safeDate(r.created_at),
          fetchedAt,
          expiresAt: null,
        },
        engagement: (() => {
          const uid = this.userId;
          if (isEvent) {
            const rsvps: string[] = r.event_rsvps ?? r.rsvps ?? [];
            return { likeCount: rsvps.length, commentCount: null, shareCount: null, viewCount: null, userLiked: uid ? rsvps.includes(uid) : null };
          }
          if (isConfession) {
            const likes: string[] = r.confession_likes ?? r.likes ?? [];
            return { likeCount: likes.length, commentCount: null, shareCount: null, viewCount: null, userLiked: uid ? likes.includes(uid) : null };
          }
          const likes: string[] = r.likes ?? [];
          return { likeCount: likes.length, commentCount: null, shareCount: null, viewCount: null, userLiked: uid ? likes.includes(uid) : null };
        })(),
        scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0 },
        diversitySlot,
        dedup: { nativeId: r.id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
        meta: { rawRow: r, rawTable: isEvent ? "events" : isConfession ? "confessions" : "posts" },
      };

      computeDedupKeys(feedItem);
      feedItem.dedup.nativeId = r.id;
      items.push(feedItem);
    }

    return items;
  }

  cachePrefix(): string {
    return "campus_v2";
  }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 999, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.lastHealth;
  }

  resetState(): void {
    this.state = { postsCursor: null, eventsCursor: null, confessionsCursor: null, done: false };
  }
}
