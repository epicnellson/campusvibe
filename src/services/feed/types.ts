export type ContentType = "image" | "video" | "article" | "text" | "gif" | "event" | "listing";

export type DiversitySlot =
  | "campus_post"
  | "campus_confession"
  | "campus_event"
  | "campus_listing"
  | "friend_post"
  | "department_post"
  | "trending_post"
  | "high_engagement"
  | "social_text"
  | "social_image"
  | "social_video"
  | "news"
  | "photo"
  | "video"
  | "gif"
  | "exploration";

export type ContentCategory =
  | "study"
  | "news"
  | "events"
  | "internships"
  | "memes"
  | "sports"
  | "gaming"
  | "music"
  | "confessions"
  | "career"
  | "technology"
  | "lifestyle"
  | "marketplace"
  | "academic"
  | "social"
  | "general";

export type MediaItem = {
  url: string;
  type: "image" | "video" | "gif";
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  videoUrl: string | null;
  duration: number | null;
  alt: string | null;
};

export type FeedItem = {
  id: string;
  source: string;
  type: ContentType;

  author: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
    profileUrl: string | null;
    verified: boolean;
  };

  content: {
    title: string | null;
    body: string | null;
    bodyHtml: string | null;
    language: string | null;
  };

  media: MediaItem[];

  urls: {
    original: string | null;
    canonical: string | null;
    domain: string | null;
  };

  timestamps: {
    publishedAt: Date | null;
    fetchedAt: Date;
    expiresAt: Date | null;
  };

  engagement: {
    likeCount: number | null;
    commentCount: number | null;
    shareCount: number | null;
    viewCount: number | null;
    userLiked: boolean | null;
  };

  scores: {
    composite: number;
    freshness: number;
    engagement: number;
    quality: number;
    diversity: number;
    interest: number;
    relationship: number;
    trending: number;
    exploration: number;
    campusRelevance: number;
    sessionFit: number;
  };

  diversitySlot: DiversitySlot;
  contentCategory: ContentCategory;

  dedup: {
    nativeId: string;
    canonicalUrl: string | null;
    imageUrl: string | null;
    videoId: string | null;
    titleHash: number;
    bodyHash: number;
  };

  meta: Record<string, unknown>;
};

export type FeedPage = {
  items: FeedItem[];
  hasMore: boolean;
  isStale: boolean;
};

export type ScoringWeights = {
  freshness: number;
  engagement: number;
  quality: number;
  diversity: number;
  interest: number;
  relationship: number;
  trending: number;
  exploration: number;
  campusRelevance: number;
  sessionFit: number;
};

export type ComposerConfig = {
  pageSize: number;
  fetchTimeoutMs: number;
  maxConcurrent: number;
  cacheTtlMs: number;
  staleWindowMs: number;
  maxInMemoryFeed: number;
  scoringWeights: ScoringWeights;
  providerPriority: Record<string, number>;
  explorationRatio: number;
  campusRatioMin: number;
  campusRatioMax: number;
  maxSameAuthor: number;
  maxConsecutiveType: number;
  candidatePoolSize: number;
};

export const DEFAULT_CONFIG: ComposerConfig = {
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
};

export type ExternalFeedItem = {
  id: string;
  source: "unsplash" | "youtube" | "news" | "mastodon" | "bluesky" | "giphy" | "pexels" | "reddit";
  type: "image" | "video" | "article" | "gif" | "text";
  title: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  link?: string;
  video_id?: string;
  published_at?: string;
  source_name?: string;
  author?: string;
};
