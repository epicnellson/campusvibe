import type { FeedItem, ScoringWeights, DiversitySlot } from "./types";

const LAMBDA = Math.LN2 / 12;

export class FeedScorer {
  private weights: ScoringWeights;
  private providerPriority: Record<string, number>;
  private userInterests = new Map<string, number>();

  constructor(weights: ScoringWeights, providerPriority: Record<string, number>) {
    this.weights = weights;
    this.providerPriority = providerPriority;
  }

  setInterests(interests: Map<string, number>): void {
    this.userInterests = interests;
  }

  score(item: FeedItem, recentItems: FeedItem[]): number {
    const freshness = this.computeFreshness(item);
    const engagement = this.computeEngagement(item);
    const quality = this.computeQuality(item);
    const diversity = this.computeDiversity(item, recentItems);
    const interest = this.computeInterest(item);
    const provider = this.computeProvider(item);

    const w = this.weights;
    const total = w.freshness + w.engagement + w.quality + w.diversity + w.interest + w.provider;

    const composite =
      (w.freshness / total) * freshness +
      (w.engagement / total) * engagement +
      (w.quality / total) * quality +
      (w.diversity / total) * diversity +
      (w.interest / total) * interest +
      (w.provider / total) * provider;

    const campusBonus = item.source === "campus" ? 0.15 : 0;

    return Math.min(1, composite + campusBonus);
  }

  scoreAll(items: FeedItem[], recentItems: FeedItem[]): FeedItem[] {
    return items.map((item) => {
      const scores = {
        composite: 0,
        freshness: this.computeFreshness(item),
        engagement: this.computeEngagement(item),
        quality: this.computeQuality(item),
        diversity: this.computeDiversity(item, recentItems),
        interest: this.computeInterest(item),
        provider: this.computeProvider(item),
      };

      const w = this.weights;
      const total = w.freshness + w.engagement + w.quality + w.diversity + w.interest + w.provider;
      const campusBonus = item.source === "campus" ? 0.15 : 0;

      scores.composite = Math.min(
        1,
        (w.freshness / total) * scores.freshness +
          (w.engagement / total) * scores.engagement +
          (w.quality / total) * scores.quality +
          (w.diversity / total) * scores.diversity +
          (w.interest / total) * scores.interest +
          (w.provider / total) * scores.provider +
          campusBonus
      );

      return { ...item, scores };
    });
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
    const slotPenalty = Math.max(0, 1 - slotCount * 0.3);
    const sourcePenalty = Math.max(0, 1 - sourceCount * 0.25);
    return slotPenalty * 0.6 + sourcePenalty * 0.4;
  }

  private computeInterest(item: FeedItem): number {
    if (this.userInterests.size === 0) return 0.5;
    const text = [item.content.title, item.content.body, item.author.name, item.urls.domain]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    let maxMatch = 0;
    for (const [keyword, weight] of this.userInterests) {
      if (text.includes(keyword.toLowerCase())) {
        maxMatch = Math.max(maxMatch, weight);
      }
    }
    return 0.3 + 0.7 * maxMatch;
  }

  private computeProvider(item: FeedItem): number {
    const base = this.providerPriority[item.source] ?? 0.5;
    return base;
  }
}
