import type { IFeedProvider } from "./providers/types";
import { CampusProvider } from "./providers/campus";
import { YouTubeProvider } from "./providers/youtube";
import { NewsProvider } from "./providers/news";
import { MastodonProvider } from "./providers/mastodon";
import { BlueskyProvider } from "./providers/bluesky";
import { UnsplashProvider } from "./providers/unsplash";
import { PexelsProvider } from "./providers/pexels";
import { GiphyProvider } from "./providers/giphy";
import { FeedComposer } from "./composer";

export type { FeedItem, FeedPage, ContentType, DiversitySlot, MediaItem, ScoringWeights, ComposerConfig, DEFAULT_CONFIG } from "./types";
export type { IFeedProvider, FetchContext, FetchResult, HealthStatus, RateBudget, PageState } from "./providers/types";

export { FeedComposer } from "./composer";
export { FeedScorer } from "./scorer";
export { FeedDeduplicator } from "./dedup";
export { SeenStore } from "./seen";
export { diversify } from "./diversifier";
export { computeDedupKeys, normalizeUrl, stripHtml, safeDate } from "./normalize";

export {
  CampusProvider,
  YouTubeProvider,
  NewsProvider,
  MastodonProvider,
  BlueskyProvider,
  UnsplashProvider,
  PexelsProvider,
  GiphyProvider,
};

export function createFeedComposer(userId: string, extraProviders: IFeedProvider[] = []): FeedComposer {
  return new FeedComposer({
    userId,
    providers: [
      new CampusProvider(userId),
      new YouTubeProvider(),
      new NewsProvider(),
      new MastodonProvider(),
      // Bluesky disabled — public.api.bsky.app returns 403 from this region
      // new BlueskyProvider(),
      new UnsplashProvider(),
      new PexelsProvider(),
      new GiphyProvider(),
      ...extraProviders,
    ],
  });
}
