import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedItem } from "./types";

const MAX_ENTRIES = 1500;
const STORAGE_KEY_PREFIX = "feed_dedup_v2_";
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

export class FeedDeduplicator {
  private idIndex = new Map<string, number>();
  private urlIndex = new Map<string, string>();
  private imageIndex = new Map<string, string>();
  private videoIndex = new Map<string, string>();
  private titleIndex = new Map<number, string>();
  private bodyIndex = new Map<number, string>();
  private timestamps = new Map<string, number>();
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private storageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.userId}`;
  }

  private tkey(prefix: string, value: string): string {
    return `${prefix}:${value}`;
  }

  private isFresh(prefix: string, value: string): boolean {
    const ts = this.timestamps.get(this.tkey(prefix, value));
    if (ts === undefined) return false;
    return Date.now() - ts < DEDUP_TTL_MS;
  }

  private markFresh(prefix: string, value: string, now: number): void {
    this.timestamps.set(this.tkey(prefix, value), now);
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
      this.timestamps = new Map(data.timestamps ?? []);
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
        timestamps: [...this.timestamps],
      };
      await AsyncStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch {}
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, ts] of [...this.timestamps]) {
      if (now - ts >= DEDUP_TTL_MS) this.timestamps.delete(key);
    }

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

    if (this.timestamps.size > MAX_ENTRIES * 6) {
      const entries = [...this.timestamps.entries()];
      const toRemove = entries.slice(0, entries.length - MAX_ENTRIES * 6);
      for (const [key] of toRemove) this.timestamps.delete(key);
    }
  }

  isDuplicate(item: FeedItem): boolean {
    if (this.idIndex.has(item.id) && this.isFresh("id", item.id)) return true;

    if (item.dedup.canonicalUrl && this.urlIndex.has(item.dedup.canonicalUrl) && this.isFresh("url", item.dedup.canonicalUrl)) return true;

    if (item.dedup.imageUrl && this.imageIndex.has(item.dedup.imageUrl) && this.isFresh("image", item.dedup.imageUrl)) return true;

    if (item.dedup.videoId && this.videoIndex.has(item.dedup.videoId) && this.isFresh("video", item.dedup.videoId)) return true;

    if (item.dedup.titleHash !== 0 && this.titleIndex.has(item.dedup.titleHash) && this.isFresh("title", String(item.dedup.titleHash))) return true;

    if (item.dedup.bodyHash !== 0 && this.bodyIndex.has(item.dedup.bodyHash) && this.isFresh("body", String(item.dedup.bodyHash))) return true;

    return false;
  }

  register(item: FeedItem): void {
    const now = Date.now();
    this.idIndex.set(item.id, now);
    this.markFresh("id", item.id, now);

    if (item.dedup.canonicalUrl) {
      this.urlIndex.set(item.dedup.canonicalUrl, item.id);
      this.markFresh("url", item.dedup.canonicalUrl, now);
    }
    if (item.dedup.imageUrl) {
      this.imageIndex.set(item.dedup.imageUrl, item.id);
      this.markFresh("image", item.dedup.imageUrl, now);
    }
    if (item.dedup.videoId) {
      this.videoIndex.set(item.dedup.videoId, item.id);
      this.markFresh("video", item.dedup.videoId, now);
    }
    if (item.dedup.titleHash !== 0) {
      this.titleIndex.set(item.dedup.titleHash, item.id);
      this.markFresh("title", String(item.dedup.titleHash), now);
    }
    if (item.dedup.bodyHash !== 0) {
      this.bodyIndex.set(item.dedup.bodyHash, item.id);
      this.markFresh("body", String(item.dedup.bodyHash), now);
    }
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
    this.timestamps.clear();
  }
}
