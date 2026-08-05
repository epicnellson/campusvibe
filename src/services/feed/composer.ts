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
import { shuffle } from "./normalize";

const DEFAULT_PAGE_SIZE = 20;
const PROVIDER_TIMEOUT_MS = 12000;
const MAX_BUFFER = 500;
const TRIM_TO = 400;
const MIN_UNSEEN = 5;

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
  private readonly MIN_UNSEEN = MIN_UNSEEN;

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
          reddit: 0.35,
          youtube: 0.3,
          unsplash: 0.2,
          pexels: 0.2,
          giphy: 0.1,
        },
        explorationRatio: 0.25,
        campusRatioMin: 0.45,
        campusRatioMax: 0.55,
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

  async loadInitial(): Promise<FeedPage> {
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
          // Fisher-Yates shuffle of the campus pool so posts (Omar, Adebayo,
          // Carlos, etc.) land in varied positions on every cold load instead of
          // the static DB/strategy order the provider returns them in.
          campusItems = shuffle(campusItems);
          campusItems = this.dedupeById(campusItems);
          this.registry.updateHealth("campus", true);
        }
      } catch {
        this.registry.updateHealth("campus", false);
        this.providerDone.set("campus", true);
      }

      // NOTE: No progressive campus-only update. The first render waits for the
      // full mixed batch (campus + external) so the feed never flashes a
      // campus-only/seed-only screen while external providers are still loading.

      // STAGE 1b: Fetch external providers concurrently
      if (externalProviders.length === 0) {
        const campusForProgressive = diversify([...campusItems], {
          pageSize: this.pageSize,
          campusRatioMin: this.config.campusRatioMin,
          campusRatioMax: this.config.campusRatioMax,
          maxSameAuthor: this.config.maxSameAuthor,
          maxConsecutiveType: this.config.maxConsecutiveType,
          explorationSlots: Math.floor(this.pageSize * this.config.explorationRatio),
        });
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

      // STAGE 2: Dedup across all sources.
      // Campus content is the app's own live social feed — it is never deduped
      // against the persistent store (only intra-batch duplicates are removed),
      // otherwise previously-shown posts would vanish on the next app load.
      // External providers are deduped so the same article/video doesn't reappear.
      const campusDeduped = this.dedupeById(campusItems);
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

      // STAGE 6: Seen-item suppression — both campus and external items the user
      // has already viewed are filtered out (freshness-first). If the unseen pool
      // runs low (< MIN_UNSEEN), older seen items are re-appended at the very
      // end of the list, never interleaved into the fresh section.
      allCandidates = this.suppressSeenWithFallback(allCandidates, this.pageSize);

      // FALLBACK: if every source came back empty (fresh account, all providers
      // down/offline), seed the feed with sample content so the screen is never
      // blank on first render. Real posts replace it as soon as data arrives.
      if (allCandidates.length === 0) {
        allCandidates = this.buildFallbackItems();
      }

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
    // Reset ALL provider state + pagination so pull-to-refresh is a clean,
    // randomized re-fetch from scratch (query indices/offsets are re-randomized
    // inside each provider, so a refresh yields varied content, not a resume
    // of the last loadMore's saved page cursors).
    this.providerPages.clear();
    this.providerDone.clear();
    this.providerSkipped.clear();
    this.registry.resetAll();
    this.registry.resetBudgets();
    for (const p of this.registry.getAll()) p.resetState();

    // Force a fresh re-fetch: drop the proxy response cache, per-request dedup,
    // rate/backoff state so pull-to-refresh actually hits the providers again
    // instead of replaying cached top-content.
    await clearTransientState();

    try {
      // Fetch all active providers fresh
      const campusResult = await this.fetchCampusFresh(signal);
      const extResult = await this.fetchExternalFresh(signal);

      // STAGE 2: Dedup. Campus items dedupe only within the batch. A manual
      // refresh is an explicit "show me the current feed" action, so external
      // items are deduped against the in-memory buffer (handled in STAGE 6) rather
      // than the persistent store — previously-shown articles/videos can resurface
      // on refresh; they're still registered below to suppress cold-load repeats.
      const campusFresh = this.dedupeById(shuffle(campusResult));
      const extFresh = this.dedupeById(extResult);
      const allRaw = [...campusFresh, ...extFresh];
      const deduped = allRaw;
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

      // STAGE 6: Seen-item suppression. The UI marks the currently-displayed
      // items as seen before calling refresh(), so a refresh is a clean slate —
      // it filters out everything already on screen AND everything viewed in the
      // past, pulling an entirely fresh, unseen batch. Older items only return
      // (at the end of the list) when the unseen pool runs low.
      let newItems = this.suppressSeenWithFallback(scored, this.pageSize);

      // NOTE: No fallback seeding here. A manual refresh is an explicit
      // "show me the current feed" action — if the API fetch finishes and
      // produces nothing, the existing buffered items stay on screen. Only a
      // cold initial load (see loadInitial) may seed sample content so a fresh
      // account is never blank.

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

      // STAGE 2: Dedup. Campus items dedupe only within the batch (never against
      // the persistent store); external items dedupe across all history.
      const campusNext = this.dedupeById(shuffle(allNormalized.filter((i) => i.source === "campus")));
      const extNext = this.dedup.filterNew(allNormalized.filter((i) => i.source !== "campus"));
      const deduped = [...campusNext, ...extNext];
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

      // STAGE 6: Seen-item suppression for pagination too — campus and external
      // items already viewed are filtered out so pagination surfaces fresh
      // content; older seen items fall back to the end of the page only when the
      // unseen pool runs low.
      let newItems = this.suppressSeenWithFallback(scored, this.pageSize);

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
          return { items: this.interleaveCampusAndExternal(final), hasMore: true, isStale: false };
        }
      }

      if (newItems.length === 0) {
        this.recycleExhaustedProviders();
      }

      for (const item of newItems) this.memoryBuffer.push(item);
      if (this.memoryBuffer.length > MAX_BUFFER) this.memoryBuffer = this.memoryBuffer.slice(-TRIM_TO);

      await this.seen.markSeen(newItems.map((i) => i.id));
      await this.dedup.persist();

      // A page that produced nothing, or produced ONLY already-seen fallback
      // items, means there's no fresh unseen content left — signal the UI to
      // stop paging (otherwise pagination would replay the same fallback page
      // forever).
      const hasUnseen = scored.some((item) => !this.seen.has(item.id));
      const hasMore = hasUnseen && newItems.length > 0;
      return { items: newItems, hasMore, isStale: false };
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

  /**
   * Sample campus posts used only when the feed would otherwise be blank
   * (fresh account, empty database, or all providers failed/offline). Rendered
   * through the normal campus normalize → PostCard path. Ids are prefixed with
   * "fallback-" so they can never collide with real docs or dedup state.
   */
  private buildFallbackItems(): FeedItem[] {
    const campus = this.registry.getById("campus");
    if (!campus) return [];

    const now = new Date();
    const rows: any[] = [
      {
        id: "fallback-welcome-1",
        __collection: "posts",
        content:
          "Welcome to CampusVibe! This is your campus feed — connect with students, share posts, and discover what's happening around campus.",
        likes: [],
        image_url: null,
        created_at: now.toISOString(),
        user_id: "campusvibe",
        profiles: { id: "campusvibe", name: "CampusVibe", department: "Community", avatar_url: null },
      },
      {
        id: "fallback-welcome-2",
        __collection: "posts",
        content:
          "Your feed will light up with posts from classmates, confessions, and events as they're shared. Pull down to refresh anytime.",
        likes: [],
        image_url: null,
        created_at: new Date(now.getTime() - 60_000).toISOString(),
        user_id: "campusvibe",
        profiles: { id: "campusvibe", name: "CampusVibe", department: "Community", avatar_url: null },
      },
      {
        id: "fallback-welcome-3",
        __collection: "posts",
        content:
          "Tip: Tap the + button to create a post, an anonymous confession, or a campus event. Everyone at your university can see what you share.",
        likes: [],
        image_url: null,
        created_at: new Date(now.getTime() - 120_000).toISOString(),
        user_id: "campusvibe",
        profiles: { id: "campusvibe", name: "CampusVibe", department: "Community", avatar_url: null },
      },
    ];

    return campus.normalize(rows, now);
  }

  private dedupeById(items: FeedItem[]): FeedItem[] {
    const seen = new Set<string>();
    const out: FeedItem[] = [];
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }

  /**
   * Seen-item suppression (both campus and external items). Strictly removes
   * any item already seen by the user so the feed always surfaces fresh content
   * first. If the unseen pool runs low (< MIN_UNSEEN), gracefully re-appends
   * older seen items to fill the page — but ONLY at the very end of the list,
   * never interleaved into the fresh section.
   */
  private suppressSeenWithFallback(candidates: FeedItem[], pageSize: number): FeedItem[] {
    const { unseen, seen } = this.seen.partition(candidates);
    if (unseen.length >= this.MIN_UNSEEN) {
      return this.interleaveCampusAndExternal(unseen);
    }
    const need = Math.max(0, pageSize - unseen.length);
    const woven = this.interleaveCampusAndExternal(unseen);
    return [...woven, ...seen.slice(0, need)];
  }

  /**
   * Evenly weave campus and external items across the whole page instead of
   * stacking campus posts in one block (e.g. all at the top after the first
   * API item). The minority group is placed at evenly-spaced positions using
   * the largest-remainder method, so with a 20-item payload you get a stable
   * "1 campus every few API items" cadence, never a campus run followed by an
   * external run.
   */
  private interleaveCampusAndExternal(items: FeedItem[]): FeedItem[] {
    const campus = items.filter((i) => i.source === "campus");
    const external = items.filter((i) => i.source !== "campus");
    if (campus.length === 0 || external.length === 0) return items;

    const [minority, majority] = campus.length <= external.length ? [campus, external] : [external, campus];
    const k = minority.length;
    const total = campus.length + external.length;

    const slots: (FeedItem | null)[] = new Array(total).fill(null);
    for (let i = 0; i < k; i++) {
      const idx = Math.min(Math.floor(((i + 0.5) * total) / k), total - 1);
      slots[idx] = minority[i];
    }

    let mi = 0;
    let mj = 0;
    const out: FeedItem[] = [];
    for (let i = 0; i < total; i++) {
      if (slots[i]) out.push(minority[mi++]);
      else out.push(majority[mj++]);
    }
    return out;
  }

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
