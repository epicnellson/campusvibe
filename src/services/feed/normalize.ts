import type { FeedItem } from "./types";

export function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return null;
  return d;
}

export function normalizeUrl(url: string): string {
  let u = url.trim().toLowerCase();
  u = u.replace(/^http:\/\//, "https://");
  try {
    const parsed = new URL(u);
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ref", "source"];
    for (const param of trackingParams) parsed.searchParams.delete(param);
    u = parsed.toString();
  } catch {}
  return u.replace(/\/$/, "");
}

function simhash(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
  let hash = 0;
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      hash = ((hash << 5) - hash + w.charCodeAt(i)) | 0;
    }
  }
  return hash;
}

function extractVideoId(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return ytMatch[1];
  return null;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

export function computeDedupKeys(item: FeedItem): void {
  const originalUrl = item.urls.original;
  const firstImage = item.media.find((m) => m.type === "image");
  const firstVideo = item.media.find((m) => m.type === "video");

  item.urls.canonical = originalUrl ? normalizeUrl(originalUrl) : null;
  item.urls.domain = originalUrl ? extractDomain(originalUrl) : null;
  item.dedup.canonicalUrl = item.urls.canonical;
  item.dedup.imageUrl = firstImage?.url ?? null;
  item.dedup.videoId = firstVideo?.videoId ?? (originalUrl ? extractVideoId(originalUrl) : null);
  item.dedup.titleHash = item.content.title ? simhash(item.content.title) : 0;
  item.dedup.bodyHash = item.content.body && item.content.body.length > 50 ? simhash(item.content.body) : 0;
}

export { simhash, extractVideoId, extractDomain };
