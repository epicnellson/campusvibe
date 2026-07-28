import type { IFeedProvider, FetchContext, FetchResult, RateBudget, HealthStatus } from "./types";
import type { FeedItem, ContentCategory } from "../types";
import { computeDedupKeys, safeDate } from "../normalize";
import { getUserProfile } from "../user-profile";
import { classifyContentCategory } from "../interests";

type CampusPageState = {
  strategyIndex: number;
  postsCursor: any;
  confessionsCursor: any;
  eventsCursor: any;
  done: boolean;
};

const CANDIDATE_PAGE_SIZE = 50;

const STRATEGIES = [
  "newest_posts",
  "friend_posts",
  "department_posts",
  "high_engagement_posts",
  "trending_posts",
  "confessions",
  "events",
  "newest_posts_page2",
  "newest_posts_page3",
  "high_engagement_page2",
] as const;

type Strategy = (typeof STRATEGIES)[number];

export class CampusProvider implements IFeedProvider {
  readonly id = "campus";
  readonly displayName = "Campus Feed";

  private state: CampusPageState = {
    strategyIndex: 0,
    postsCursor: null,
    confessionsCursor: null,
    eventsCursor: null,
    done: false,
  };
  private lastHealth: HealthStatus = {
    state: "healthy",
    consecutiveFailures: 0,
    lastSuccess: null,
    lastFailure: null,
    cooldownUntil: null,
  };
  private userId: string | undefined;

  constructor(userId?: string) {
    this.userId = userId;
  }

  async fetch(ctx: FetchContext): Promise<FetchResult> {
    if (this.state.done) return { rawItems: [], nextPageState: this.state, hasMore: false, budgetCost: 0 };

    try {
      const { db_ops } = await import("@/services/db");

      const allRawItems: any[] = [];
      const strategiesRun: Strategy[] = [];

      const profile = this.userId ? await getUserProfile(this.userId).catch(() => null) : null;
      const friendIds = profile ? [...profile.friendIds].slice(0, 20) : [];
      const followingIds = profile ? [...profile.followingIds].slice(0, 30) : [];
      const department = profile?.department ?? null;

      const strategyBatch = STRATEGIES.slice(this.state.strategyIndex, this.state.strategyIndex + 3);
      const fetchPromises: Promise<{ strategy: Strategy; items: any[] }>[] = [];

      for (const strategy of strategyBatch) {
        switch (strategy) {
          case "newest_posts":
          case "newest_posts_page2":
          case "newest_posts_page3": {
            const pageNum = strategy === "newest_posts_page3" ? 3 : strategy === "newest_posts_page2" ? 2 : 1;
            fetchPromises.push(
              (async () => {
                let cursor = this.state.postsCursor;
                if (pageNum === 2 && this.state.postsCursor) {
                  cursor = this.state.postsCursor;
                }
                const opts: any = {
                  orderBy: [{ field: "created_at", direction: "desc" as const }],
                  limitCount: CANDIDATE_PAGE_SIZE,
                };
                if (cursor && pageNum > 1) opts.startAfterDoc = cursor;
                const items = await db_ops.query("posts", opts);
                if (items?.length > 0) this.state.postsCursor = items[items.length - 1];
                return { strategy, items: (items ?? []).map((p: any) => ({ ...p, __collection: "posts", __strategy: strategy })) };
              })()
            );
            break;
          }

          case "friend_posts": {
            if (friendIds.length === 0) {
              fetchPromises.push(Promise.resolve({ strategy, items: [] }));
              break;
            }
            fetchPromises.push(
              (async () => {
                const BATCH = 10;
                const allPosts: any[] = [];
                for (let i = 0; i < friendIds.length; i += BATCH) {
                  const batch = friendIds.slice(i, i + BATCH);
                  for (const fid of batch) {
                    try {
                      const posts = await db_ops.query("posts", {
                        conditions: [{ field: "user_id", op: "==", value: fid }],
                        orderBy: [{ field: "created_at", direction: "desc" as const }],
                        limitCount: 5,
                      });
                      if (posts) allPosts.push(...posts.map((p: any) => ({ ...p, __collection: "posts", __strategy: strategy, __friendId: fid })));
                    } catch {}
                  }
                }
                return { strategy, items: allPosts };
              })()
            );
            break;
          }

          case "department_posts": {
            if (!department) {
              fetchPromises.push(Promise.resolve({ strategy, items: [] }));
              break;
            }
            fetchPromises.push(
              (async () => {
                const deptProfiles = profile ? [...profile.departmentPeers].slice(0, 20) : [];
                if (deptProfiles.length === 0) {
                  const deptPosts = await db_ops.query("posts", {
                    orderBy: [{ field: "created_at", direction: "desc" as const }],
                    limitCount: 30,
                  });
                  const filtered = (deptPosts ?? []).filter((p: any) => {
                    return true;
                  });
                  return { strategy, items: filtered.map((p: any) => ({ ...p, __collection: "posts", __strategy: strategy })) };
                }
                const allPosts: any[] = [];
                const BATCH = 10;
                for (let i = 0; i < deptProfiles.length; i += BATCH) {
                  const batch = deptProfiles.slice(i, i + BATCH);
                  for (const pid of batch) {
                    try {
                      const posts = await db_ops.query("posts", {
                        conditions: [{ field: "user_id", op: "==", value: pid }],
                        orderBy: [{ field: "created_at", direction: "desc" as const }],
                        limitCount: 3,
                      });
                      if (posts) allPosts.push(...posts.map((p: any) => ({ ...p, __collection: "posts", __strategy: strategy })));
                    } catch {}
                  }
                }
                return { strategy, items: allPosts };
              })()
            );
            break;
          }

          case "high_engagement_posts": {
            fetchPromises.push(
              (async () => {
                const recentPosts = await db_ops.query("posts", {
                  orderBy: [{ field: "created_at", direction: "desc" as const }],
                  limitCount: 80,
                });
                const scored = (recentPosts ?? []).map((p: any) => {
                  const likes = (p.likes ?? []).length;
                  const content = (p.content ?? "") as string;
                  const commentHint = (content.match(/@/g) ?? []).length;
                  const engagementScore = likes * 2 + commentHint;
                  return { ...p, __collection: "posts", __strategy: strategy, __engagementScore: engagementScore };
                });
                scored.sort((a: any, b: any) => b.__engagementScore - a.__engagementScore);
                return { strategy, items: scored.slice(0, 40) };
              })()
            );
            break;
          }

          case "high_engagement_page2": {
            fetchPromises.push(
              (async () => {
                const recentPosts = await db_ops.query("posts", {
                  orderBy: [{ field: "created_at", direction: "desc" as const }],
                  limitCount: 80,
                });
                const scored = (recentPosts ?? []).map((p: any) => {
                  const likes = (p.likes ?? []).length;
                  return { ...p, __collection: "posts", __strategy: strategy, __engagementScore: likes };
                });
                scored.sort((a: any, b: any) => b.__engagementScore - a.__engagementScore);
                return { strategy, items: scored.slice(20, 60) };
              })()
            );
            break;
          }

          case "trending_posts": {
            fetchPromises.push(
              (async () => {
                const recentPosts = await db_ops.query("posts", {
                  orderBy: [{ field: "created_at", direction: "desc" as const }],
                  limitCount: 100,
                });
                const now = Date.now();
                const trending = (recentPosts ?? []).map((p: any) => {
                  const likes = (p.likes ?? []).length;
                  const ageHours = p.created_at ? Math.max(0.1, (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60)) : 999;
                  const velocity = likes / Math.max(1, ageHours);
                  return { ...p, __collection: "posts", __strategy: strategy, __velocity: velocity };
                });
                trending.sort((a: any, b: any) => b.__velocity - a.__velocity);
                return { strategy, items: trending.slice(0, 25) };
              })()
            );
            break;
          }

          case "confessions": {
            fetchPromises.push(
              (async () => {
                const opts: any = {
                  orderBy: [{ field: "created_at", direction: "desc" as const }],
                  limitCount: 30,
                };
                if (this.state.confessionsCursor) opts.startAfterDoc = this.state.confessionsCursor;
                const items = await db_ops.query("confessions", opts);
                if (items?.length > 0) this.state.confessionsCursor = items[items.length - 1];
                return { strategy, items: (items ?? []).map((c: any) => ({ ...c, __collection: "confessions", __strategy: strategy })) };
              })()
            );
            break;
          }

          case "events": {
            fetchPromises.push(
              (async () => {
                const today = new Date().toISOString().split("T")[0];
                const opts: any = {
                  conditions: [{ field: "date", op: ">=" as const, value: today }],
                  orderBy: [{ field: "date", direction: "asc" as const }],
                  limitCount: 20,
                };
                if (this.state.eventsCursor) opts.startAfterDoc = this.state.eventsCursor;
                const items = await db_ops.query("events", opts);
                if (items?.length > 0) this.state.eventsCursor = items[items.length - 1];
                return { strategy, items: (items ?? []).map((e: any) => ({ ...e, __collection: "events", __strategy: strategy })) };
              })()
            );
            break;
          }
        }
      }

      const results = await Promise.allSettled(fetchPromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          const { strategy, items } = result.value;
          strategiesRun.push(strategy);
          allRawItems.push(...items);
        }
      }

      await this.batchAttachProfiles(allRawItems);

      this.state.strategyIndex = Math.min(this.state.strategyIndex + 3, STRATEGIES.length);
      if (this.state.strategyIndex >= STRATEGIES.length) {
        this.state.done = true;
      }

      const hasMore = !this.state.done || allRawItems.length > 0;
      this.lastHealth = {
        state: "healthy",
        consecutiveFailures: 0,
        lastSuccess: new Date(),
        lastFailure: null,
        cooldownUntil: null,
      };

      return { rawItems: allRawItems, nextPageState: this.state, hasMore, budgetCost: 0 };
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
      const strategy = (r.__strategy as string) ?? "";
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
        body = r.content ?? "";
        imageUrl = r.image_url ?? null;

        if (strategy === "friend_posts") {
          diversitySlot = "friend_post";
        } else if (strategy === "department_posts") {
          diversitySlot = "department_post";
        } else if (strategy === "trending_posts") {
          diversitySlot = "trending_post";
        } else if (strategy === "high_engagement_posts" || strategy === "high_engagement_page2") {
          diversitySlot = "high_engagement";
        } else {
          diversitySlot = "campus_post";
        }
      } else {
        type = "text";
        diversitySlot = "campus_post";
        body = r.content ?? "";
      }

      const category = classifyContentCategory(body || (r.title as string) || "");
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
        scores: { composite: 0, freshness: 0, engagement: 0, quality: 0, diversity: 0, interest: 0, relationship: 0, trending: 0, exploration: 0, campusRelevance: 0, sessionFit: 0 },
        diversitySlot,
        contentCategory: category as ContentCategory,
        dedup: { nativeId: r.id, canonicalUrl: null, imageUrl: null, videoId: null, titleHash: 0, bodyHash: 0 },
        meta: { rawRow: r, rawTable: isEvent ? "events" : isConfession ? "confessions" : "posts", strategy, friendId: r.__friendId ?? null },
      };

      computeDedupKeys(feedItem);
      feedItem.dedup.nativeId = r.id;
      items.push(feedItem);
    }

    return items;
  }

  cachePrefix(): string {
    return "campus_v3";
  }

  getBudget(): RateBudget {
    return { providerId: this.id, dailyLimit: 999, used: 0, windowResetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), isExhausted: false };
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.lastHealth;
  }

  resetState(): void {
    this.state = { strategyIndex: 0, postsCursor: null, confessionsCursor: null, eventsCursor: null, done: false };
  }

  private async batchAttachProfiles(items: any[]): Promise<void> {
    const userIds = new Set<string>();
    for (const item of items) {
      if (item.user_id) userIds.add(item.user_id);
    }
    if (userIds.size === 0) return;

    const profileMap = new Map<string, any>();
    const { db_ops } = await import("@/services/db");
    const ids = [...userIds];
    const BATCH = 10;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const profiles = await Promise.all(batch.map((id) => db_ops.get("profiles", id)));
      for (const p of profiles) {
        if (p) profileMap.set(p.id, p);
      }
    }

    for (const item of items) {
      if (item.user_id && profileMap.has(item.user_id)) {
        item.profiles = profileMap.get(item.user_id);
      }
    }
  }
}
