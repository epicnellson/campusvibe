import type { FeedItem, FeedPage, ComposerConfig, DEFAULT_CONFIG } from "./types";
import { ProviderRegistry } from "./providers/registry";
import type { IFeedProvider, FetchContext, FetchResult, PageState } from "./providers/types";
import { FeedScorer } from "./scorer";
import { FeedDeduplicator } from "./dedup";
import { SeenStore } from "./seen";
import { diversify } from "./diversifier";
import { fetchConcurrentIndependent } from "./fetch-utils";
import { clearTransientState } from "./budget";
import { getUserProfile, type CachedUserProfile } from "./user-profile";
import { getUserInterests, type UserInterests } from "./interests";
import { updateTrendingCache } from "./trending";

const DEFAULT_PAGE_SIZE = 20;
const PROVIDER_TIMEOUT_MS = 12000;
const MAX_BUFFER = 500;
const TRIM_TO = 400;

type FeedComposerOptions = {
  userId: string;
  pageSize?: number;
  providers: IFeedProvider[];
  config?: Partial<ComposerConfig>;
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
  private userProfile: CachedUserProfile | null = null;
  private userInterests: UserInterests | null = null;
  private config: ComposerConfig;

  constructor(opts: FeedComposerOptions) {
    this.userId = opts.userId;
    this.pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

    this.config = {
      ...({
        pageSize: 20,
        fetchTimeoutMs: 8000,
        maxConcurrent: 3,
        cacheTtlMs: 15 * 60 * 1000,
        staleWindowMs: 5 * 60 * 1000,
        maxInMemoryFeed: 500,
        scoringWeights: {
          freshness: 0.22,
          engagement: 0.15,
          quality: 0.10,
          diversity: 0.12,
          interest: 0.15,
          relationship: 0.12,
          trending: 0.06,
          exploration: 0.04,
          campusRelevance: 0.02,
          sessionFit: 0.02,
        },
        providerPriority: {
          campus: 1.0,
          bluesky: 0.5,
          news: 0.4,
          mastodon: 0.4,
          youtube: 0.3,
          unsplash: 0.2,
          pexels: 0.2,
          giphy: 0.1,
        },
        explorationRatio: 0.18,
        campusRatioMin: 0.70,
        campusRatioMax: 0.85,
        maxSameAuthor: 2,
        maxConsecutiveType: 3,
        candidatePoolSize: 300,
      } as ComposerConfig),
      ...opts.config,
    };

    this.registry = new ProviderRegistry();
    for (const p of opts.providers) this.registry.register(p);

    this.scorer = new FeedScorer(
      this.config.scoringWeights,
      this.config.providerPriority
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

    this.loadPersonalization().catch(() => {});
  }

  private async loadPersonalization(): Promise<void> {
    try {
      const [profile, interests] = await Promise.all([
        getUserProfile(this.userId),
        getUserInterests(this.userId),
      ]);
      this.userProfile = profile;
      this.userInterests = interests;
      this.scorer.setUserProfile(profile);
      this.scorer.setInterests(interests);
    } catch {}
  }

  async loadInitial(onProgressiveUpdate?: (items: FeedItem[], hasMore: boolean) => void): Promise<FeedPage> {
    if (this.loadingLock) return { items: [], hasMore: false, isStale: false };
    this.loadingLock = true;

    this.abort();
    await this.init();

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.memoryBuffer = [];
    this.providerPages.clear();
    this.providerDone.clear();
    this.providerSkipped.clear();
    this.registry.resetAll();
    this.registry.resetBudgets();
    for (const p of this.registry.getAll()) p.resetState();

    await clearTransientState();

    try {
      // STAGE 1: Build large candidate pool from campus
      const campusProvider = this.registry.getById("campus");
      const externalProviders = this.getActiveProviders().filter((p) => p.id !== "campus");

      const campusCtx: FetchContext = {
        pageSize: this.config.candidatePoolSize,
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

      // Progressive update with campus items only
      const campusForProgressive = diversify([...campusItems], {
        pageSize: this.pageSize,
        campusRatioMin: this.config.campusRatioMin,
        campusRatioMax: this.config.campusRatioMax,
        maxSameAuthor: this.config.maxSameAuthor,
        maxConsecutiveType: this.config.maxConsecutiveType,
        explorationSlots: Math.floor(this.pageSize * this.config.explorationRatio),
      });

      if (campusForProgressive.length > 0 && onProgressiveUpdate) {
        onProgressiveUpdate(campusForProgressive, true);
      }

      // STAGE 1b: Fetch external providers concurrently
      if (externalProviders.length === 0) {
        for (const item of campusForProgressive) {
          this.memoryBuffer.push(item);
        }
        this.updateTrendingFromItems(campusItems);
        await this.seen.markSeen(campusForProgressive.map((i) => i.id));
        await this.dedup.persist();
        return { items: campusForProgressive, hasMore: true, isStale: false };
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
          if (newCount >= 3) this.providerDone.set(providerId, true);
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

      // STAGE 2: Dedup across all sources
      const campusDeduped = this.dedup.filterNew(campusItems);
      const extDeduped = this.dedup.filterNew(allExternalNormalized);
      for (const item of [...campusDeduped, ...extDeduped]) {
        this.dedup.register(item);
      }

      // STAGE 3: Merge all candidates
      let allCandidates = [...campusDeduped, ...extDeduped];

      // STAGE 4: Score all candidates
      allCandidates = this.scorer.scoreAll(allCandidates, []);

      // STAGE 5: Diversify with strict rules
      allCandidates = diversify(allCandidates, {
        pageSize: this.pageSize,
        campusRatioMin: this.config.campusRatioMin,
        campusRatioMax: this.config.campusRatioMax,
        maxSameAuthor: this.config.maxSameAuthor,
        maxConsecutiveType: this.config.maxConsecutiveType,
        explorationSlots: Math.floor(this.pageSize * this.config.explorationRatio),
      });

      // STAGE 6: Filter seen items
      allCandidates = this.seen.filterNew(allCandidates);

      this.memoryBuffer = [...allCandidates];
      if (this.memoryBuffer.length > MAX_BUFFER) {
        this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
      }

      this.updateTrendingFromItems(allCandidates);
      await this.seen.markSeen(allCandidates.map((i) => i.id));
      await this.dedup.persist();

      return { items: allCandidates, hasMore: true, isStale: false };
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

    // Refresh personalization data
    this.userProfile = null;
    this.userInterests = null;
    await this.loadPersonalization();

    // Do NOT clear seen — rolling history is preserved across refreshes
    // Reset campus provider to fetch latest
    const campus = this.registry.getById("campus");
    if (campus) campus.resetState();

    try {
      // Fetch all active providers fresh
      const campusResult = await this.fetchCampusFresh(signal);
      const extResult = await this.fetchExternalFresh(signal);

      // STAGE 2: Dedup
      const allRaw = [...campusResult, ...extResult];
      const deduped = this.dedup.filterNew(allRaw);
      for (const item of deduped) {
        this.dedup.register(item);
      }

      // STAGE 3-4: Score
      let scored = this.scorer.scoreAll(deduped, this.memoryBuffer.slice(-5));

      // STAGE 5: Diversify
      scored = diversify(scored, {
        pageSize: this.pageSize,
        campusRatioMin: this.config.campusRatioMin,
        campusRatioMax: this.config.campusRatioMax,
        maxSameAuthor: this.config.maxSameAuthor,
        maxConsecutiveType: this.config.maxConsecutiveType,
        explorationSlots: Math.floor(this.pageSize * this.config.explorationRatio),
      });

      // STAGE 6: Filter seen (but allow resurfacing after 24h)
      const newItems = this.seen.filterNew(scored);

      // Merge: new items on top, then existing buffer (minus items already in newItems)
      const newItemIds = new Set(newItems.map((i) => i.id));
      const remainingBuffer = this.memoryBuffer.filter((i) => !newItemIds.has(i.id));
      this.memoryBuffer = [...newItems, ...remainingBuffer];

      if (this.memoryBuffer.length > MAX_BUFFER) {
        this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
      }

      this.updateTrendingFromItems(allRaw);
      await this.seen.markSeen(newItems.map((i) => i.id));
      await this.dedup.persist();

      return { items: newItems, hasMore: true, isStale: false };
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
          if (newCount >= 3) this.providerDone.set(providerId, true);
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

      // STAGE 2: Dedup
      const deduped = this.dedup.filterNew(allNormalized);
      for (const item of deduped) {
        this.dedup.register(item);
      }

      // STAGE 4: Score
      let scored = this.scorer.scoreAll(deduped, this.memoryBuffer.slice(-5));

      // STAGE 5: Diversify
      scored = diversify(scored, {
        pageSize: this.pageSize,
        campusRatioMin: this.config.campusRatioMin,
        campusRatioMax: this.config.campusRatioMax,
        maxSameAuthor: this.config.maxSameAuthor,
        maxConsecutiveType: this.config.maxConsecutiveType,
        explorationSlots: Math.floor(this.pageSize * this.config.explorationRatio),
      });

      // STAGE 6: Filter seen
      const newItems = scored.filter((item) => !this.seen.has(item.id));

      // Fallback: if all filtered, try items not in memory buffer
      if (newItems.length === 0 && allNormalized.length > 0) {
        const fallbackItems = allNormalized.filter((item) => !this.memoryBuffer.some((m) => m.id === item.id));
        if (fallbackItems.length > 0) {
          let fallbackScored = this.scorer.scoreAll(fallbackItems, this.memoryBuffer.slice(-5));
          fallbackScored = diversify(fallbackScored, {
            pageSize: this.pageSize,
            campusRatioMin: this.config.campusRatioMin,
            campusRatioMax: this.config.campusRatioMax,
            maxSameAuthor: this.config.maxSameAuthor,
            maxConsecutiveType: this.config.maxConsecutiveType,
            explorationSlots: 0,
          });
          const final = fallbackScored.slice(0, this.pageSize);
          for (const item of final) this.memoryBuffer.push(item);
          if (this.memoryBuffer.length > MAX_BUFFER) this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);
          await this.seen.markSeen(final.map((i) => i.id));
          await this.dedup.persist();
          return { items: final, hasMore: true, isStale: false };
        }
      }

      if (newItems.length === 0) {
        this.recycleExhaustedProviders();
      }

      for (const item of newItems) this.memoryBuffer.push(item);
      if (this.memoryBuffer.length > MAX_BUFFER) this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);

      await this.seen.markSeen(newItems.map((i) => i.id));
      await this.dedup.persist();

      return { items: newItems, hasMore: true, isStale: false };
    } finally {
      this.loadingLock = false;
    }
  }

  touchItems(ids: string[]): void {
    if (ids.length === 0) return;
    this.seen.touch(ids);
    this.seen.persist();
  }

  getBufferedItems(): FeedItem[] {
    return [...this.memoryBuffer];
  }

  addProvider(provider: IFeedProvider): void {
    this.registry.register(provider);
  }

  removeProvider(id: string): void {
    this.registry.unregister(id);
  }

  // Private helpers

  private getActiveProviders(): IFeedProvider[] {
    return this.registry.getWithinBudget().filter((p) => {
      const skipCount = this.providerSkipped.get(p.id) ?? 0;
      if (skipCount >= 3) return false;
      return true;
    });
  }

  private recycleExhaustedProviders(): void {
    this.providerDone.clear();
    this.providerSkipped.clear();
    this.providerPages.clear();
    this.registry.resetBudgets();
    for (const p of this.registry.getAll()) p.resetState();
  }

  private async fetchCampusFresh(signal: AbortSignal): Promise<FeedItem[]> {
    const campus = this.registry.getById("campus");
    if (!campus) return [];

    try {
      const campusCtx: FetchContext = {
        pageSize: this.config.candidatePoolSize,
        timeoutMs: PROVIDER_TIMEOUT_MS,
        signal,
        pageState: {},
      };
      const result = await campus.fetch(campusCtx);
      this.providerPages.set("campus", result.nextPageState);
      this.providerDone.set("campus", !result.hasMore);
      if (result.rawItems.length > 0) {
        this.registry.updateHealth("campus", true);
        return campus.normalize(result.rawItems, new Date());
      }
    } catch {
      this.registry.updateHealth("campus", false);
    }
    return [];
  }

  private async fetchExternalFresh(signal: AbortSignal): Promise<FeedItem[]> {
    const providers = this.getActiveProviders().filter((p) => p.id !== "campus");
    if (providers.length === 0) return [];

    const results = await this.fetchIndependent(providers, signal);
    const allNormalized: FeedItem[] = [];

    for (const [providerId, result] of results) {
      const provider = this.registry.getById(providerId);
      if (!provider) continue;
      this.providerPages.set(providerId, result.nextPageState);
      if (result._skipped) {
        const prev = this.providerSkipped.get(providerId) ?? 0;
        this.providerSkipped.set(providerId, prev + 1);
        if (prev + 1 >= 3) this.providerDone.set(providerId, true);
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

  private updateTrendingFromItems(items: FeedItem[]): void {
    const trendingItems = items
      .filter((i) => i.source === "campus" && i.timestamps.publishedAt)
      .map((i) => ({
        id: i.id,
        source: i.source,
        likeCount: i.engagement?.likeCount ?? 0,
        commentCount: i.engagement?.commentCount ?? 0,
        shareCount: i.engagement?.shareCount ?? 0,
        publishedAt: i.timestamps.publishedAt,
      }));
    updateTrendingCache(trendingItems);
  }
}
