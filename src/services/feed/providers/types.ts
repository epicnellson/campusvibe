export type PageState = Record<string, unknown>;

export type FetchContext = {
  pageState?: PageState;
  pageSize: number;
  timeoutMs: number;
  signal: AbortSignal;
};

export type FetchResult = {
  rawItems: unknown[];
  nextPageState: PageState | null;
  hasMore: boolean;
  budgetCost: number;
  _skipped?: boolean;
};

export type HealthStatus = {
  state: "healthy" | "degraded" | "broken";
  consecutiveFailures: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  cooldownUntil: Date | null;
};

export type RateBudget = {
  providerId: string;
  dailyLimit: number;
  used: number;
  windowResetsAt: Date;
  isExhausted: boolean;
};

export interface IFeedProvider {
  readonly id: string;
  readonly displayName: string;

  fetch(ctx: FetchContext): Promise<FetchResult>;
  normalize(raw: unknown[], fetchedAt: Date): import("../types").FeedItem[];
  cachePrefix(): string;
  getBudget(): RateBudget;
  healthCheck(): Promise<HealthStatus>;
  resetState(): void;
}
