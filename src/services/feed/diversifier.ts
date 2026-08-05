import type { FeedItem, DiversitySlot } from "./types";

const SLOT_CAPACITY: Record<DiversitySlot, number> = {
  campus_post: 4,
  campus_confession: 2,
  campus_event: 2,
  campus_listing: 1,
  friend_post: 3,
  department_post: 2,
  trending_post: 2,
  high_engagement: 2,
  social_text: 1,
  social_image: 1,
  social_video: 1,
  news: 1,
  photo: 1,
  video: 1,
  gif: 1,
  exploration: 2,
};

function sourceGroup(item: FeedItem): string {
  if (item.source === "campus") return "campus";
  if (item.source === "youtube") return "youtube";
  if (item.source === "news") return "news";
  return item.source;
}

type DiversifyOptions = {
  pageSize: number;
  campusRatioMin?: number;
  campusRatioMax?: number;
  maxSameAuthor?: number;
  maxConsecutiveType?: number;
  explorationSlots?: number;
};

export function diversify(items: FeedItem[], opts: DiversifyOptions): FeedItem[] {
  const {
    pageSize,
    campusRatioMin = 0.45,
    campusRatioMax = 0.55,
    maxSameAuthor = 2,
    maxConsecutiveType = 3,
    explorationSlots = 0,
  } = opts;

  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.scores.composite - a.scores.composite);
  const result: FeedItem[] = [];
  const slotCounts = new Map<DiversitySlot, number>();
  const groupCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  const lastTwoSources: string[] = [];
  const lastThreeTypes: string[] = [];
  const candidates = [...sorted];
  let campusCount = 0;
  let explorationCount = 0;

  const explorationTarget = Math.max(explorationSlots, Math.floor(pageSize * 0.18));

  while (candidates.length > 0 && result.length < pageSize) {
    let bestIdx = -1;
    let bestScore = -1;

    const totalSoFar = result.length;
    const campusRatio = totalSoFar > 0 ? campusCount / totalSoFar : 0;
    const needMoreCampus = campusRatio < campusRatioMin;
    const campusFull = campusRatio >= campusRatioMax;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const slot = item.diversitySlot;
      const group = sourceGroup(item);
      const count = slotCounts.get(slot) ?? 0;
      const capacity = SLOT_CAPACITY[slot] ?? 1;
      const groupCount = groupCounts.get(group) ?? 0;
      const authorId = (item.meta?.rawRow as any)?.user_id ?? (item.meta?.rawRow as any)?.seller_id ?? "unknown";
      const authorCount = authorCounts.get(authorId) ?? 0;
      const isCampus = item.source === "campus";

      let penalty = 0;

      if (count >= capacity) penalty += 0.5;

      const recentSame = lastTwoSources.filter((s) => s === group).length;
      if (recentSame >= 2) penalty += 0.4;
      else if (recentSame === 1) penalty += 0.15;

      const consecutiveTypes = lastThreeTypes.filter((t) => t === item.type).length;
      if (consecutiveTypes >= maxConsecutiveType) penalty += 0.5;

      if (authorCount >= maxSameAuthor) penalty += 0.6;

      if (groupCount > 0 && groupCounts.size > 1) {
        const avgPerGroup = totalSoFar / groupCounts.size;
        if (groupCount > avgPerGroup * 1.5) penalty += 0.2;
      }

      if (isCampus && campusFull) penalty += 0.15;
      if (!isCampus && needMoreCampus) penalty += 0.3;

      if (item.diversitySlot === "exploration" && explorationCount >= explorationTarget) penalty += 0.4;

      const adjustedScore = item.scores.composite * (1 - penalty);

      if (adjustedScore > bestScore) {
        bestIdx = i;
        bestScore = adjustedScore;
      }
    }

    if (bestIdx === -1) break;

    const chosen = candidates.splice(bestIdx, 1)[0];
    result.push(chosen);

    const slot = chosen.diversitySlot;
    const group = sourceGroup(chosen);
    const authorId = (chosen.meta?.rawRow as any)?.user_id ?? (chosen.meta?.rawRow as any)?.seller_id ?? "unknown";

    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    authorCounts.set(authorId, (authorCounts.get(authorId) ?? 0) + 1);

    if (chosen.source === "campus") campusCount++;
    if (chosen.diversitySlot === "exploration") explorationCount++;

    lastTwoSources.push(group);
    if (lastTwoSources.length > 2) lastTwoSources.shift();

    lastThreeTypes.push(chosen.type);
    if (lastThreeTypes.length > 3) lastThreeTypes.shift();
  }

  return result;
}
