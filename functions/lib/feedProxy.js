"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const UPSTREAM_TIMEOUT_MS = 8000;
function fetchWithTimeout(url, init = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, Object.assign(Object.assign({}, init), { signal: controller.signal }))
        .finally(() => clearTimeout(timer));
}
async function proxyYouTube(params) {
    var _a, _b, _c, _d, _e;
    const key = process.env.YOUTUBE_API_KEY;
    if (!key)
        throw new Error("YouTube API key not configured");
    const type = (_a = params.get("type")) !== null && _a !== void 0 ? _a : "popular";
    const pageSize = (_b = params.get("pageSize")) !== null && _b !== void 0 ? _b : "20";
    if (type === "popular") {
        const pageToken = (_c = params.get("pageToken")) !== null && _c !== void 0 ? _c : "";
        const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
        const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=${pageSize}&key=${key}${pageParam}`);
        if (!res.ok)
            throw new Error(`YouTube ${res.status}`);
        return res.json();
    }
    if (type === "search") {
        const q = (_d = params.get("q")) !== null && _d !== void 0 ? _d : "";
        const pageToken = (_e = params.get("pageToken")) !== null && _e !== void 0 ? _e : "";
        const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
        const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=${Math.min(parseInt(pageSize), 10)}&key=${key}${pageParam}`);
        if (!res.ok)
            throw new Error(`YouTube search ${res.status}`);
        return res.json();
    }
    throw new Error("Invalid YouTube type");
}
async function proxyNews(params) {
    var _a, _b, _c;
    const key = process.env.NEWS_API_KEY;
    if (!key)
        throw new Error("News API key not configured");
    const q = (_a = params.get("q")) !== null && _a !== void 0 ? _a : "university";
    const page = (_b = params.get("page")) !== null && _b !== void 0 ? _b : "1";
    const pageSize = (_c = params.get("pageSize")) !== null && _c !== void 0 ? _c : "20";
    const res = await fetchWithTimeout(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&pageSize=${pageSize}&page=${page}&sortBy=publishedAt&apiKey=${key}`);
    if (!res.ok)
        throw new Error(`NewsAPI ${res.status}`);
    return res.json();
}
async function proxyUnsplash(params) {
    var _a, _b, _c, _d;
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key)
        throw new Error("Unsplash API key not configured");
    const q = (_a = params.get("q")) !== null && _a !== void 0 ? _a : "campus";
    const page = (_b = params.get("page")) !== null && _b !== void 0 ? _b : "1";
    const perPage = (_c = params.get("perPage")) !== null && _c !== void 0 ? _c : "20";
    const orientation = (_d = params.get("orientation")) !== null && _d !== void 0 ? _d : "";
    const orientParam = orientation ? `&orientation=${orientation}` : "";
    const res = await fetchWithTimeout(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}&order_by=relevant${orientParam}`, { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok)
        throw new Error(`Unsplash ${res.status}`);
    return res.json();
}
async function proxyMastodon(params) {
    var _a, _b, _c;
    const token = process.env.MASTODON_ACCESS_TOKEN;
    if (!token)
        throw new Error("Mastodon token not configured");
    const q = (_a = params.get("q")) !== null && _a !== void 0 ? _a : "";
    const maxId = (_b = params.get("max_id")) !== null && _b !== void 0 ? _b : "";
    const limit = (_c = params.get("limit")) !== null && _c !== void 0 ? _c : "20";
    const searchParams = new URLSearchParams({ q, limit, resolve: "false" });
    if (maxId)
        searchParams.set("max_id", maxId);
    const res = await fetchWithTimeout(`https://mastodon.social/api/v2/search?${searchParams}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
        throw new Error(`Mastodon ${res.status}`);
    return res.json();
}
async function proxyGiphy(params) {
    var _a, _b, _c, _d;
    const key = process.env.GIPHY_API_KEY;
    if (!key)
        throw new Error("Giphy API key not configured");
    const type = (_a = params.get("type")) !== null && _a !== void 0 ? _a : "trending";
    const q = (_b = params.get("q")) !== null && _b !== void 0 ? _b : "";
    const offset = (_c = params.get("offset")) !== null && _c !== void 0 ? _c : "0";
    const limit = (_d = params.get("limit")) !== null && _d !== void 0 ? _d : "20";
    if (type === "trending") {
        const res = await fetchWithTimeout(`https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=${limit}&offset=${offset}&rating=g`);
        if (!res.ok)
            throw new Error(`Giphy ${res.status}`);
        return res.json();
    }
    if (type === "search") {
        const res = await fetchWithTimeout(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${Math.min(parseInt(limit), 10)}&offset=${offset}&rating=g`);
        if (!res.ok)
            throw new Error(`Giphy search ${res.status}`);
        return res.json();
    }
    throw new Error("Invalid Giphy type");
}
async function proxyPexels(params) {
    var _a, _b, _c, _d;
    const key = process.env.PEXELS_API_KEY;
    if (!key)
        throw new Error("Pexels API key not configured");
    const type = (_a = params.get("type")) !== null && _a !== void 0 ? _a : "photo";
    const q = (_b = params.get("q")) !== null && _b !== void 0 ? _b : "campus";
    const page = (_c = params.get("page")) !== null && _c !== void 0 ? _c : "1";
    const perPage = (_d = params.get("perPage")) !== null && _d !== void 0 ? _d : "20";
    const endpoint = type === "video"
        ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`
        : `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`;
    const res = await fetchWithTimeout(endpoint, { headers: { Authorization: key } });
    if (!res.ok)
        throw new Error(`Pexels ${res.status}`);
    return res.json();
}
async function proxyBluesky(params) {
    var _a, _b, _c;
    const q = (_a = params.get("q")) !== null && _a !== void 0 ? _a : "campus";
    const limit = (_b = params.get("limit")) !== null && _b !== void 0 ? _b : "15";
    const cursor = (_c = params.get("cursor")) !== null && _c !== void 0 ? _c : "";
    const searchParams = new URLSearchParams({ q, limit });
    if (cursor)
        searchParams.set("cursor", cursor);
    const res = await fetchWithTimeout(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${searchParams}`, {
        headers: { "User-Agent": "CampusVibe/1.0" },
    });
    if (!res.ok)
        throw new Error(`Bluesky ${res.status}`);
    return res.json();
}
const ROUTERS = {
    youtube: proxyYouTube,
    news: proxyNews,
    unsplash: proxyUnsplash,
    mastodon: proxyMastodon,
    giphy: proxyGiphy,
    pexels: proxyPexels,
    bluesky: proxyBluesky,
};
/**
 * GET /feedProxy?provider=youtube&type=popular
 * Proxies API requests to third-party providers,
 * keeping API keys server-side.
 */
exports.feedProxy = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a;
    if (req.method === "OPTIONS") {
        res.status(204).send();
        return;
    }
    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const url = new URL(req.url, `https://${req.hostname}`);
    const provider = url.searchParams.get("provider");
    if (!provider || !(provider in ROUTERS)) {
        res.status(404).json({ error: "Unknown provider" });
        return;
    }
    try {
        const data = await ROUTERS[provider](url.searchParams);
        res.json(data);
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.name) === "AbortError" || ((_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.includes("UPSTREAM_TIMEOUT"))) {
            res.status(504).json({ error: `${provider} upstream timeout` });
            return;
        }
        console.error(`[feedProxy] ${provider} error:`, err);
        res.status(502).json({ error: "Provider request failed" });
    }
});
//# sourceMappingURL=feedProxy.js.map