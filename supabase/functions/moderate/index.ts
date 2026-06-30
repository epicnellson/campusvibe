import { withSupabase } from "@supabase/server"

/**
 * POST /moderate
 * Checks content with OpenAI Moderation API using the secret key
 * (bypasses RLS, server-side only).
 *
 * Auth mode: "secret" — requires SUPABASE_SECRET_KEY header.
 * verify_jwt = false in config.toml since there's no user token.
 */
export const fetch = withSupabase({ auth: "secret" }, async (req, ctx) => {
  const { content, content_type, content_id } = await req.json()

  if (!content) {
    return Response.json({ error: "Missing content" }, { status: 400 })
  }

  // Call OpenAI Moderation
  const openAiRes = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: content }),
  })

  if (!openAiRes.ok) {
    return Response.json(
      { error: "Moderation service unavailable" },
      { status: 502 }
    )
  }

  const { results } = await openAiRes.json()
  const [result] = results

  // If flagged, create a report using the admin client (bypasses RLS)
  if (result.flagged) {
    await ctx.supabaseAdmin.from("reports").insert({
      content_type,
      content_id,
      reason: "Flagged by moderation",
      reported_by: null, // system-generated
    })
  }

  return Response.json({
    flagged: result.flagged,
    categories: result.categories,
    scores: result.category_scores,
  })
})
