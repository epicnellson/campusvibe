import { withSupabase } from "@supabase/server"

/**
 * GET /profiles
 * Returns all profiles in the same email domain as the requesting user.
 * Auth mode: "user" — validates the JWT and injects an RLS-scoped client.
 */
export const fetch = withSupabase({ auth: "user" }, async (_req, ctx) => {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, name, department, year, avatar_url")

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ profiles: data })
})
