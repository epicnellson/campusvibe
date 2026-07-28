import type { FeedItem, ScoringWeights } from "./types";
import type { UserInterests } from "./interests";
import type { CachedUserProfile } from "./user-profile";
import { computeKeywordScore } from "./interests";
import { computeTrendingScore, getTrendingScore } from "./trending";
import { computeSessionFitScore, getCampusBoost, getExternalBoost, getConfessionBoost } from "./time-aware";

const LAMBDA = Math.LN2 / 12;

export class FeedScorer {
  private weights: ScoringWeights;
  private providerPriority: Record<string, number>;
  private userInterests: UserInterests | null = null;
  private userProfile: CachedUserProfile | null = null;
  private recentlySeenAuthors = new Map<string, number>();

  constructor(weights: ScoringWeights, providerPriority: Record<string, number>) {
    this.weights = weights;
    this.providerPriority = providerPriority;
  }

  setInterests(interests: UserInterests): void {
    this.userInterests = interests;
  }

  setUserProfile(profile: CachedUserProfile): void {
    this.userProfile = profile;
  }

  recordRecentlySeenAuthor(authorId: string): void {
    this.recentlySeenAuthors.set(authorId, Date.now());
  }

  score(item: FeedItem, recentItems: FeedItem[]): number {
    const scores = this.computeAllScores(item, recentItems);
    return scores.composite;
  }

  scoreAll(items: FeedItem[], recentItems: FeedItem[]): FeedItem[] {
    return items.map((item) => {
      const scores = this.computeAllScores(item, recentItems);
      return { ...item, scores };
    });
  }

  private computeAllScores(item: FeedItem, recentItems: FeedItem[]) {
    const freshness = this.computeFreshness(item);
    const engagement = this.computeEngagement(item);
    const quality = this.computeQuality(item);
    const diversity = this.computeDiversity(item, recentItems);
    const interest = this.computeInterest(item);
    const relationship = this.computeRelationship(item);
    const trending = this.computeTrending(item);
    const exploration = this.computeExploration(item);
    const campusRelevance = this.computeCampusRelevance(item);
    const sessionFit = this.computeSessionFit(item);

    const w = this.weights;
    const total = w.freshness + w.engagement + w.quality + w.diversity + w.interest +
      w.relationship + w.trending + w.exploration + w.campusRelevance + w.sessionFit;

    const composite = Math.min(1, Math.max(0,
      (w.freshness / total) * freshness +
      (w.engagement / total) * engagement +
      (w.quality / total) * quality +
      (w.diversity / total) * diversity +
      (w.interest / total) * interest +
      (w.relationship / total) * relationship +
      (w.trending / total) * trending +
      (w.exploration / total) * exploration +
      (w.campusRelevance / total) * campusRelevance +
      (w.sessionFit / total) * sessionFit
    ));

    return {
      composite,
      freshness,
      engagement,
      quality,
      diversity,
      interest,
      relationship,
      trending,
      exploration,
      campusRelevance,
      sessionFit,
    };
  }

  private computeFreshness(item: FeedItem): number {
    const publishedAt = item.timestamps.publishedAt;
    if (!publishedAt) return 0.1;
    const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
    return Math.exp(-LAMBDA * ageHours);
  }

  private computeEngagement(item: FeedItem): number {
    const e = item.engagement;
    if (!e) return 0.3;
    const likes = e.likeCount ?? 0;
    const comments = e.commentCount ?? 0;
    const shares = e.shareCount ?? 0;
    const views = e.viewCount ?? 0;
    const raw =
      Math.log(1 + shares) * 3.0 +
      Math.log(1 + comments) * 2.0 +
      Math.log(1 + likes) * 1.0 +
      Math.log(1 + views) * 0.3;
    return 0.3 + 0.7 * (1 - Math.exp(-raw / 5));
  }

  private computeQuality(item: FeedItem): number {
    let score = 0;
    if (item.media.length > 0) score += 1;
    if (item.content.body && item.content.body.length > 10) score += 1;
    if (item.content.title && item.content.title.length > 5) score += 1;
    if (item.author.name && item.author.name !== "Unknown") score += 1;
    if (item.timestamps.publishedAt) score += 1;
    score += Math.min((item.content.body?.length ?? 0) / 300, 1);
    return score / 6;
  }

  private computeDiversity(item: FeedItem, recentItems: FeedItem[]): number {
    if (recentItems.length === 0) return 1.0;
    const last5 = recentItems.slice(-5);

    const slotCount = last5.filter((i) => i.diversitySlot === item.diversitySlot).length;
    const sourceCount = last5.filter((i) => i.source === item.source).length;
    const categoryCount = last5.filter((i) => i.contentCategory === item.contentCategory).length;

    const authorId = (item.meta?.rawRow as any)?.user_id;
    const authorCount = authorId ? last5.filter((i) => (i.meta?.rawRow as any)?.user_id === authorId).length : 0;

    const slotPenalty = Math.max(0, 1 - slotCount * 0.25);
    const sourcePenalty = Math.max(0, 1 - sourceCount * 0.2);
    const categoryPenalty = Math.max(0, 1 - categoryCount * 0.15);
    const authorPenalty = Math.max(0, 1 - authorCount * 0.3);

    return slotPenalty * 0.3 + sourcePenalty * 0.2 + categoryPenalty * 0.25 + authorPenalty * 0.25;
  }

  private computeInterest(item: FeedItem): number {
    if (!this.userInterests) return 0.5;

    const text = [item.content.title, item.content.body, item.author.name, item.urls.domain]
      .filter(Boolean)
      .join(" ");

    const keywordScore = computeKeywordScore(text, this.userInterests);

    const categoryBoost = this.userInterests.categoryAffinity.get(item.contentCategory) ?? 0;

    const authorId = (item.meta?.rawRow as any)?.user_id;
    const authorBoost = authorId ? (this.userInterests.authorAffinity.get(authorId) ?? 0) : 0;

    return Math.min(1, keywordScore * 0.5 + Math.min(1, 0.5 + categoryBoost) * 0.3 + Math.min(1, 0.5 + authorBoost) * 0.2);
  }

  private computeRelationship(item: FeedItem): number {
    if (!this.userProfile) return 0.3;

    const authorId = (item.meta?.rawRow as any)?.user_id;
    if (!authorId) return 0.3;

    if (this.userProfile.friendIds.has(authorId)) return 1.0;
    if (this.userProfile.followingIds.has(authorId)) return 0.8;
    if (this.userProfile.followerIds.has(authorId)) return 0.6;
    if (this.userProfile.departmentPeers.has(authorId)) return 0.5;

    return 0.2;
  }

  private computeTrending(item: FeedItem): number {
    if (!item.timestamps.publishedAt) return 0;

    const likes = item.engagement?.likeCount ?? 0;
    const comments = item.engagement?.commentCount ?? 0;
    const shares = item.engagement?.shareCount ?? 0;

    const cached = getTrendingScore(item.id);
    if (cached > 0) return cached;

    return computeTrendingScore({
      likeCount: likes,
      commentCount: comments,
      shareCount: shares,
      publishedAt: item.timestamps.publishedAt,
    });
  }

  private computeExploration(item: FeedItem): number {
    const authorId = (item.meta?.rawRow as any)?.user_id;
    if (!authorId) return 0.5;

    const lastSeen = this.recentlySeenAuthors.get(authorId);
    if (!lastSeen) return 0.9;

    const hoursSince = (Date.now() - lastSeen) / (1000 * 60 * 60);
    return Math.min(1, 0.3 + hoursSince * 0.05);
  }

  private computeCampusRelevance(item: FeedItem): number {
    if (item.source !== "campus") return 0;

    let score = 0.5;

    const boost = getCampusBoost();
    score += boost;

    if (item.meta?.strategy === "friend_posts") score += 0.2;
    if (item.meta?.strategy === "department_posts") score += 0.15;
    if (item.meta?.strategy === "trending_posts") score += 0.1;

    const dept = this.userProfile?.department;
    const postDept = (item.meta?.rawRow as any)?.department;
    if (dept && postDept && dept === postDept) score += 0.15;

    return Math.min(1, score);
  }

  private computeSessionFit(item: FeedItem): number {
    return computeSessionFitScore(item.contentCategory);
  }
}
