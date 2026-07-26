import type { FeedItem, DiversitySlot } from "./types";

const SLOT_CAPACITY: Record<DiversitySlot, number> = {
  campus_post: 3,
  campus_confession: 2,
  campus_event: 2,
  campus_listing: 1,
  social_text: 1,
  social_image: 1,
  social_video: 1,
  news: 1,
  video: 1,
  photo: 1,
  gif: 1,
};

function sourceOf(item: FeedItem): string {
  return item.source;
}

function sourceGroup(item: FeedItem): string {
  if (item.source === "campus") return "campus";
  if (item.source === "youtube") return "youtube";
  if (item.source === "news") return "news";
  return item.source;
}

export function diversify(items: FeedItem[], pageSize: number): FeedItem[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.scores.composite - a.scores.composite);
  const result: FeedItem[] = [];
  const slotCounts = new Map<DiversitySlot, number>();
  const groupCounts = new Map<string, number>();
  const lastTwoSources: string[] = [];
  const candidates = [...sorted];

  while (candidates.length > 0 && result.length < pageSize) {
    let bestIdx = -1;
    let bestScore = -1;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const slot = item.diversitySlot;
      const group = sourceGroup(item);
      const count = slotCounts.get(slot) ?? 0;
      const capacity = SLOT_CAPACITY[slot] ?? 1;
      const groupCount = groupCounts.get(group) ?? 0;

      let penalty = 0;

      if (count >= capacity) {
        penalty += 0.5;
      }

      const recentSame = lastTwoSources.filter((s) => s === group).length;
      if (recentSame >= 2) {
        penalty += 0.4;
      } else if (recentSame === 1) {
        penalty += 0.15;
      }

      if (groupCount > 0 && groupCounts.size > 1) {
        const avgPerGroup = result.length / groupCounts.size;
        if (groupCount > avgPerGroup * 1.5) {
          penalty += 0.2;
        }
      }

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
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);

    lastTwoSources.push(group);
    if (lastTwoSources.length > 2) lastTwoSources.shift();
  }

  return result;
}
