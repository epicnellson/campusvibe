import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedItem } from "./types";

const MAX_ENTRIES = 1500;
const STORAGE_KEY_PREFIX = "feed_dedup_v2_";

export class FeedDeduplicator {
  private idIndex = new Map<string, number>();
  private urlIndex = new Map<string, string>();
  private imageIndex = new Map<string, string>();
  private videoIndex = new Map<string, string>();
  private titleIndex = new Map<number, string>();
  private bodyIndex = new Map<number, string>();
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private storageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.userId}`;
  }

  async restore(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      this.idIndex = new Map(data.idIndex ?? []);
      this.urlIndex = new Map(data.urlIndex ?? []);
      this.imageIndex = new Map(data.imageIndex ?? []);
      this.videoIndex = new Map(data.videoIndex ?? []);
      this.titleIndex = new Map(data.titleIndex ?? []);
      this.bodyIndex = new Map(data.bodyIndex ?? []);
    } catch {}
  }

  async persist(): Promise<void> {
    try {
      this.evict();
      const data = {
        idIndex: [...this.idIndex],
        urlIndex: [...this.urlIndex],
        imageIndex: [...this.imageIndex],
        videoIndex: [...this.videoIndex],
        titleIndex: [...this.titleIndex],
        bodyIndex: [...this.bodyIndex],
      };
      await AsyncStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch {}
  }

  private evict(): void {
    const evictIfNeeded = (map: Map<string, unknown>) => {
      if (map.size > MAX_ENTRIES) {
        const entries = [...map.entries()];
        const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
        for (const [key] of toRemove) map.delete(key);
      }
    };
    evictIfNeeded(this.idIndex as Map<string, unknown>);
    evictIfNeeded(this.urlIndex);
    evictIfNeeded(this.imageIndex);
    evictIfNeeded(this.videoIndex);

    const evictHash = (map: Map<number, string>) => {
      if (map.size > MAX_ENTRIES) {
        const entries = [...map.entries()];
        const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
        for (const [key] of toRemove) map.delete(key);
      }
    };
    evictHash(this.titleIndex);
    evictHash(this.bodyIndex);
  }

  isDuplicate(item: FeedItem): boolean {
    if (this.idIndex.has(item.id)) return true;

    if (item.dedup.canonicalUrl && this.urlIndex.has(item.dedup.canonicalUrl)) return true;

    if (item.dedup.imageUrl && this.imageIndex.has(item.dedup.imageUrl)) return true;

    if (item.dedup.videoId && this.videoIndex.has(item.dedup.videoId)) return true;

    if (item.dedup.titleHash !== 0 && this.titleIndex.has(item.dedup.titleHash)) return true;

    if (item.dedup.bodyHash !== 0 && this.bodyIndex.has(item.dedup.bodyHash)) return true;

    return false;
  }

  register(item: FeedItem): void {
    const now = Date.now();
    this.idIndex.set(item.id, now);

    if (item.dedup.canonicalUrl) this.urlIndex.set(item.dedup.canonicalUrl, item.id);
    if (item.dedup.imageUrl) this.imageIndex.set(item.dedup.imageUrl, item.id);
    if (item.dedup.videoId) this.videoIndex.set(item.dedup.videoId, item.id);
    if (item.dedup.titleHash !== 0) this.titleIndex.set(item.dedup.titleHash, item.id);
    if (item.dedup.bodyHash !== 0) this.bodyIndex.set(item.dedup.bodyHash, item.id);
  }

  filterNew(items: FeedItem[]): FeedItem[] {
    return items.filter((item) => !this.isDuplicate(item));
  }

  clear(): void {
    this.idIndex.clear();
    this.urlIndex.clear();
    this.imageIndex.clear();
    this.videoIndex.clear();
    this.titleIndex.clear();
    this.bodyIndex.clear();
  }
}
