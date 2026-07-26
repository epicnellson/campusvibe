import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FeedItem } from "./types";

const MAX_SEEN = 1000;
const STORAGE_KEY_PREFIX = "feed_seen_v3_";

export class SeenStore {
  private order: string[] = [];
  private seen = new Set<string>();
  private userId: string;
  private dirty = false;

  constructor(userId: string) {
    this.userId = userId;
  }

  private storageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.userId}`;
  }

  async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey());
      if (!raw) return;
      const data: { ids: string[] } = JSON.parse(raw);
      this.order = data.ids ?? [];
      this.seen = new Set(this.order);
    } catch {}
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }

  touch(ids: string[]): void {
    for (const id of ids) {
      if (this.seen.has(id)) {
        const idx = this.order.indexOf(id);
        if (idx !== -1) this.order.splice(idx, 1);
        this.order.push(id);
      } else {
        this.seen.add(id);
        this.order.push(id);
      }
    }
    this.evict();
    this.dirty = true;
  }

  async markSeen(ids: string[]): Promise<void> {
    this.touch(ids);
    await this.persist();
  }

  filterNew(items: FeedItem[]): FeedItem[] {
    return items.filter((item) => !this.seen.has(item.id));
  }

  async persist(): Promise<void> {
    if (!this.dirty) return;
    try {
      await AsyncStorage.setItem(
        this.storageKey(),
        JSON.stringify({ ids: this.order })
      );
      this.dirty = false;
    } catch {}
  }

  async clear(): Promise<void> {
    this.order = [];
    this.seen.clear();
    this.dirty = true;
    try {
      await AsyncStorage.removeItem(this.storageKey());
    } catch {}
  }

  get size(): number {
    return this.seen.size;
  }

  private evict(): void {
    while (this.order.length > MAX_SEEN) {
      const evicted = this.order.shift()!;
      this.seen.delete(evicted);
    }
  }
}
