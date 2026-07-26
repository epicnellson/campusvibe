import type { FeedItem, FeedPage } from "./types";
import { ProviderRegistry } from "./providers/registry";
import type { IFeedProvider, FetchContext, FetchResult, PageState } from "./providers/types";
import { FeedScorer } from "./scorer";
import { FeedDeduplicator } from "./dedup";
import { SeenStore } from "./seen";
import { diversify } from "./diversifier";
import { fetchConcurrentIndependent } from "./fetch-utils";
import { clearTransientState } from "./budget";

const DEFAULT_PAGE_SIZE = 20;
const PROVIDER_TIMEOUT_MS = 12000;
const MAX_BUFFER = 500;
const TRIM_TO = 400;

type FeedComposerOptions = {
  userId: string;
  pageSize?: number;
  providers: IFeedProvider[];
};

export class FeedComposer {
  private registry: ProviderRegistry;
  private scorer: FeedScorer;
  private dedup: FeedDeduplicator;
  private seen: SeenStore;

  private memoryBuffer: FeedItem[] = [];
  private providerPages = new Map<string, unknown>();
  private providerDone = new Map<string, boolean>();
  private providerSkipped = new Map<string, number>();
  private pageSize: number;
  private userId: string;
  private initialized = false;
  private abortController: AbortController | null = null;
  private loadingLock = false;

  constructor(opts: FeedComposerOptions) {
    this.userId = opts.userId;
    this.pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

    this.registry = new ProviderRegistry();
    for (const p of opts.providers) this.registry.register(p);

    this.scorer = new FeedScorer(
      {
        freshness: 0.30,
        engagement: 0.20,
        quality: 0.15,
        diversity: 0.15,
        interest: 0.10,
        provider: 0.10,
      },
      {
        campus: 1.0,
        news: 0.5,
        mastodon: 0.4,
        youtube: 0.4,
        giphy: 0.3,
        unsplash: 0.3,
        pexels: 0.3,
      }
    );

    this.dedup = new FeedDeduplicator(opts.userId);
    this.seen = new SeenStore(opts.userId);
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([this.dedup.restore(), this.seen.load()]);
    this.initialized = true;
  }

  async loadInitial(onProgressiveUpdate?: (items: FeedItem[], hasMore: boolean) => void): Promise<FeedPage> {
    if (this.loadingLock) return { items: [], hasMore: false, isStale: false };
    this.loadingLock = true;

    this.abort();
    await this.init();

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.dedup.clear();
    this.memoryBuffer = [];
    this.providerPages.clear();
    this.providerDone.clear();
    this.providerSkipped.clear();
    this.registry.resetAll();
    this.registry.resetBudgets();
    for (const p of this.registry.getAll()) p.resetState();

    await clearTransientState();
    await this.seen.clear();

    try {
      const campusProvider = this.registry.getById("campus");
      const externalProviders = this.getActiveProviders().filter((p) => p.id !== "campus");

      const campusCtx: FetchContext = {
        pageSize: this.pageSize,
        timeoutMs: PROVIDER_TIMEOUT_MS,
        signal,
        pageState: {},
      };

      let campusItems: FeedItem[] = [];
      try {
        const campusResult = await campusProvider!.fetch(campusCtx);
        this.providerPages.set("campus", campusResult.nextPageState);
        this.providerDone.set("campus", !campusResult.hasMore);
        if (campusResult.rawItems.length > 0) {
          campusItems = campusProvider!.normalize(campusResult.rawItems, new Date());
          this.registry.updateHealth("campus", true);
        }
      } catch {
        this.registry.updateHealth("campus", false);
        this.providerDone.set("campus", true);
      }

      const campusDeduped = this.dedup.filterNew(campusItems);
      for (const item of campusDeduped) {
        this.dedup.register(item);
      }

      let campusScored = this.scorer.scoreAll(campusDeduped, []);
      campusScored = this.stableSort(campusScored);
      const campusForProgressive = diversify([...campusScored], this.pageSize);
      const campusRendered = this.seen.filterNew(campusForProgressive);

      for (const item of campusRendered) {
        this.memoryBuffer.push(item);
      }

      if (campusRendered.length > 0 && onProgressiveUpdate) {
        onProgressiveUpdate(campusRendered, true);
      }

      if (externalProviders.length === 0) {
        await this.dedup.persist();
        return { items: campusRendered, hasMore: true, isStale: false };
      }

      const extResults = await this.fetchIndependent(externalProviders, signal);

      const allExternalNormalized: FeedItem[] = [];
      for (const [providerId, result] of extResults) {
        const provider = this.registry.getById(providerId);
        if (!provider) continue;

        this.providerPages.set(providerId, result.nextPageState);

        if (result._skipped) {
          const prev = this.providerSkipped.get(providerId) ?? 0;
          const newCount = prev + 1;
          this.providerSkipped.set(providerId, newCount);
          if (newCount >= 3) {
            this.providerDone.set(providerId, true);
          } else {
            this.providerDone.set(providerId, false);
          }
        } else {
          this.providerSkipped.delete(providerId);
        }

        if (result.budgetCost > 0) this.registry.recordBudgetConsumption(providerId, result.budgetCost);

        if (result.rawItems.length > 0) {
          const normalized = provider.normalize(result.rawItems, new Date());
          allExternalNormalized.push(...normalized);
          this.registry.updateHealth(providerId, true);
        }
      }

      const extDeduped = this.dedup.filterNew(allExternalNormalized);
      for (const item of extDeduped) {
        this.dedup.register(item);
      }

      let allItems = [...campusScored, ...extDeduped];
      allItems = this.scorer.scoreAll(allItems, []);
      allItems = this.stableSort(allItems);
      allItems = diversify(allItems, this.pageSize);
      allItems = this.seen.filterNew(allItems);

      this.memoryBuffer = [...allItems];
      if (this.memoryBuffer.length > MAX_BUFFER) {
        this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
      }

      await this.seen.markSeen(allItems.map((i) => i.id));
      await this.dedup.persist();

      return {
        items: allItems,
        hasMore: true,
        isStale: false,
      };
    } finally {
      this.loadingLock = false;
    }
  }

  async refresh(): Promise<FeedPage> {
    if (this.loadingLock) return { items: [], hasMore: false, isStale: false };
    this.loadingLock = true;

    this.abort();
    await this.init();

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Clear dedup, seen, and external caches so full feed reappears on refresh
    this.dedup.clear();
    await this.seen.clear();
    await clearTransientState();

    // Reset campus provider to get latest posts; external providers continue cycling
    const campus = this.registry.getById("campus");
    if (campus) campus.resetState();

    try {
      const allNormalized = await this.fetchFromActiveProviders(signal);

      for (const item of allNormalized) {
        this.dedup.register(item);
      }

      let scored = this.scorer.scoreAll(allNormalized, this.memoryBuffer.slice(-5));
      scored = this.stableSort(scored);
      scored = diversify(scored, this.pageSize);

      const newItems = this.seen.filterNew(scored);

      this.memoryBuffer = [...newItems, ...this.memoryBuffer];

      if (this.memoryBuffer.length > MAX_BUFFER) {
        this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
      }

      await this.seen.markSeen(newItems.map((i) => i.id));
      await this.dedup.persist();

      return {
        items: newItems,
        hasMore: true,
        isStale: false,
      };
    } finally {
      this.loadingLock = false;
    }
  }

  async loadMore(): Promise<FeedPage> {
    if (this.loadingLock) return { items: [], hasMore: false, isStale: false };
    this.loadingLock = true;

    await this.init();

    try {
      let providers = this.getActiveProviders();
      if (providers.length === 0) {
        this.recycleExhaustedProviders();
        providers = this.getActiveProviders();
      }

      if (providers.length === 0) {
        return { items: [], hasMore: false, isStale: false };
      }

      const signal = this.abortController?.signal ?? new AbortController().signal;
      const results = await this.fetchIndependent(providers, signal);

      const allNormalized: FeedItem[] = [];
      for (const [providerId, result] of results) {
        const provider = this.registry.getById(providerId);
        if (!provider) continue;

        this.providerPages.set(providerId, result.nextPageState);

        if (result._skipped) {
          const prev = this.providerSkipped.get(providerId) ?? 0;
          const newCount = prev + 1;
          this.providerSkipped.set(providerId, newCount);
          if (newCount >= 3) {
            this.providerDone.set(providerId, true);
          } else {
            this.providerDone.set(providerId, false);
          }
        } else {
          this.providerSkipped.delete(providerId);
        }

        if (result.budgetCost > 0) this.registry.recordBudgetConsumption(providerId, result.budgetCost);

        if (result.rawItems.length > 0) {
          const normalized = provider.normalize(result.rawItems, new Date());
          allNormalized.push(...normalized);
          this.registry.updateHealth(providerId, true);
        }
      }

      const deduped = this.dedup.filterNew(allNormalized);
      for (const item of deduped) {
        this.dedup.register(item);
      }

      let scored = this.scorer.scoreAll(deduped, this.memoryBuffer.slice(-5));
      scored = this.stableSort(scored);
      scored = diversify(scored, this.pageSize);

      const newItems = scored.filter((item) => !this.seen.has(item.id));

      if (newItems.length === 0 && allNormalized.length > 0) {
        const dedupedFallback = allNormalized.filter((item) => !this.memoryBuffer.some((m) => m.id === item.id));
        if (dedupedFallback.length > 0) {
          let fallbackScored = this.scorer.scoreAll(dedupedFallback, this.memoryBuffer.slice(-5));
          fallbackScored = this.stableSort(fallbackScored);
          const fallbackItems = fallbackScored.slice(0, this.pageSize);
          for (const item of fallbackItems) {
            this.memoryBuffer.push(item);
          }
          if (this.memoryBuffer.length > MAX_BUFFER) {
            this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
          }
          await this.seen.markSeen(fallbackItems.map((i) => i.id));
          await this.dedup.persist();
          return { items: fallbackItems, hasMore: true, isStale: false };
        }
      }

      if (newItems.length === 0) {
        this.recycleExhaustedProviders();
      }

      for (const item of newItems) {
        this.memoryBuffer.push(item);
      }

      if (this.memoryBuffer.length > MAX_BUFFER) {
        this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
      }

      await this.seen.markSeen(newItems.map((i) => i.id));
      await this.dedup.persist();

      return {
        items: newItems,
        hasMore: true,
        isStale: false,
      };
    } finally {
      this.loadingLock = false;
    }
  }

  touchItems(ids: string[]): void {
    if (ids.length === 0) return;
    this.seen.touch(ids);
    this.seen.persist();
  }

  private getActiveProviders(): IFeedProvider[] {
    return this.registry.getWithinBudget().filter((p) => {
      const skipCount = this.providerSkipped.get(p.id) ?? 0;
      if (skipCount >= 3) return false;
      return true;
    });
  }

  private recycleExhaustedProviders(): void {
    // Reset all provider done states and skip counts to allow infinite cycling
    this.providerDone.clear();
    this.providerSkipped.clear();
    this.providerPages.clear();
    this.registry.resetBudgets();
    for (const p of this.registry.getAll()) p.resetState();
  }

  private async fetchFromActiveProviders(signal: AbortSignal): Promise<FeedItem[]> {
    const providers = this.getActiveProviders();
    if (providers.length === 0) return [];

    const results = await this.fetchIndependent(providers, signal);

    const allNormalized: FeedItem[] = [];
    for (const [providerId, result] of results) {
      const provider = this.registry.getById(providerId);
      if (!provider) continue;

      this.providerPages.set(providerId, result.nextPageState);

      if (result._skipped) {
        const prev = this.providerSkipped.get(providerId) ?? 0;
        const newCount = prev + 1;
        this.providerSkipped.set(providerId, newCount);
        if (newCount >= 3) {
          this.providerDone.set(providerId, true);
        } else {
          this.providerDone.set(providerId, false);
        }
      } else {
        this.providerSkipped.delete(providerId);
      }

      if (result.budgetCost > 0) this.registry.recordBudgetConsumption(providerId, result.budgetCost);

      if (result.rawItems.length > 0) {
        const normalized = provider.normalize(result.rawItems, new Date());
        allNormalized.push(...normalized);
        this.registry.updateHealth(providerId, true);
      }
    }

    return allNormalized;
  }

  private stableSort(items: FeedItem[]): FeedItem[] {
    return [...items].sort((a, b) => {
      const scoreDiff = b.scores.composite - a.scores.composite;
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

      const aTime = a.timestamps.publishedAt?.getTime() ?? 0;
      const bTime = b.timestamps.publishedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  private async fetchIndependent(
    providers: IFeedProvider[],
    signal: AbortSignal
  ): Promise<Map<string, FetchResult>> {
    const tasks = providers.map((provider) => ({
      key: provider.id,
      run: async (fetchSignal: AbortSignal): Promise<FetchResult> => {
        const savedState = this.providerPages.get(provider.id) as PageState | undefined;
        const fetchCtx: FetchContext = {
          pageSize: this.pageSize,
          timeoutMs: PROVIDER_TIMEOUT_MS,
          signal: fetchSignal,
          pageState: savedState ?? ({} as PageState),
        };
        return provider.fetch(fetchCtx);
      },
    }));

    const results = await fetchConcurrentIndependent(tasks, {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      signal,
    });

    const output = new Map<string, FetchResult>();
    for (const [key, result] of results) {
      if (result.ok) {
        output.set(key, result.value);
      } else {
        this.registry.updateHealth(key, false);
        this.providerDone.set(key, true);
      }
    }
    return output;
  }

  addProvider(provider: IFeedProvider): void {
    this.registry.register(provider);
  }

  removeProvider(id: string): void {
    this.registry.unregister(id);
  }

  getBufferedItems(): FeedItem[] {
    return [...this.memoryBuffer];
  }
}
