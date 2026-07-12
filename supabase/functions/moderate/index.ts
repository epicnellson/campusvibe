import { createClient } from "npm:@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/**
 * POST /moderate
 * Checks content with OpenAI Moderation API using the server-side secret key.
 * Accessible without JWT verification (verify_jwt = false) so the client
 * can call it via supabase.functions.invoke() without CORS issues.
 */
export const fetch = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS })
  }

  let body: { content?: string; content_type?: string; content_id?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  const { content, content_type, content_id } = body
  if (!content) {
    return Response.json({ error: "Missing content" }, { status: 400, headers: CORS_HEADERS })
  }

  const apiKey = Deno.env.get("EXPO_PUBLIC_OPENAI_API_KEY")
  if (!apiKey) {
    return Response.json({ flagged: false, categories: [] }, { headers: CORS_HEADERS })
  }

  // Call OpenAI Moderation
  const openAiRes = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: content }),
  })

  if (!openAiRes.ok) {
    console.error("[moderate] OpenAI error:", await openAiRes.text())
    return Response.json(
      { error: "Moderation service unavailable" },
      { status: 502, headers: CORS_HEADERS }
    )
  }

  const { results } = await openAiRes.json()
  const [result] = results

  // If flagged, create a report using the admin client (bypasses RLS)
  if (result.flagged && content_type && content_id && supabaseKey) {
    try {
      const admin = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await admin.from("reports").insert({
        content_type,
        content_id,
        reason: "Flagged by moderation",
        reported_by: null,
      })
    } catch (err) {
      console.error("[moderate] Failed to create report:", err)
    }
  }

  return Response.json({
    flagged: result.flagged,
    categories: result.categories,
    scores: result.category_scores,
  }, { headers: CORS_HEADERS })
}
