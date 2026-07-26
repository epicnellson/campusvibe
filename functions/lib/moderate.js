"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderate = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
};
/**
 * POST /moderate
 * Checks content with OpenAI Moderation API.
 * If flagged, auto-creates a report in Firestore.
 */
exports.moderate = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a;
    if (req.method === "OPTIONS") {
        res.set(CORS_HEADERS).status(204).send();
        return;
    }
    if (req.method !== "POST") {
        res.set(CORS_HEADERS).status(405).json({ error: "Method not allowed" });
        return;
    }
    const { content, content_type, content_id } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!content) {
        res.set(CORS_HEADERS).status(400).json({ error: "Missing content" });
        return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.set(CORS_HEADERS).json({ flagged: false, categories: [] });
        return;
    }
    try {
        const openAiRes = await fetch("https://api.openai.com/v1/moderations", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ input: content }),
        });
        if (!openAiRes.ok) {
            console.error("[moderate] OpenAI error:", await openAiRes.text());
            res.set(CORS_HEADERS).status(502).json({ error: "Moderation service unavailable" });
            return;
        }
        const { results } = (await openAiRes.json());
        const [result] = results;
        // If flagged, create a report in Firestore
        if (result.flagged && content_type && content_id) {
            try {
                await db.collection("reports").add({
                    content_type,
                    content_id,
                    reason: "Flagged by moderation",
                    reported_by: null,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch (err) {
                console.error("[moderate] Failed to create report:", err);
            }
        }
        res.set(CORS_HEADERS).json({
            flagged: result.flagged,
            categories: result.categories,
            scores: result.category_scores,
        });
    }
    catch (err) {
        console.error("[moderate] Error:", err);
        res.set(CORS_HEADERS).status(502).json({ error: "Moderation failed" });
    }
});
//# sourceMappingURL=moderate.js.map