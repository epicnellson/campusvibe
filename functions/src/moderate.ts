import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

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
export const moderate = onRequest({ cors: true }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.set(CORS_HEADERS).status(204).send();
    return;
  }

  if (req.method !== "POST") {
    res.set(CORS_HEADERS).status(405).json({ error: "Method not allowed" });
    return;
  }

  const { content, content_type, content_id } = req.body ?? {};
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

    const { results } = (await openAiRes.json()) as any;
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
      } catch (err) {
        console.error("[moderate] Failed to create report:", err);
      }
    }

    res.set(CORS_HEADERS).json({
      flagged: result.flagged,
      categories: result.categories,
      scores: result.category_scores,
    });
  } catch (err) {
    console.error("[moderate] Error:", err);
    res.set(CORS_HEADERS).status(502).json({ error: "Moderation failed" });
  }
});
