import { withSupabase } from "@supabase/server"

/**
 * Admin endpoint — handles reports management
 *
 * GET  /admin         → list all reports
 * POST /admin/dismiss → dismiss a report by id
 * POST /admin/ban     → delete content and ban the user
 */
export const fetch = withSupabase({ auth: "user" }, async (req, ctx) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/$/, "")
  const method = req.method

  // GET /admin — list all reports
  if (method === "GET") {
    const { data, error } = await ctx.supabaseAdmin
      .from("reports")
      .select("*, reporter:profiles!reported_by(*)")
      .order("created_at", { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ reports: data })
  }

  // POST /admin/dismiss — remove a report
  if (method === "POST" && path.endsWith("/dismiss")) {
    const { id } = await req.json()
    const { error } = await ctx.supabaseAdmin.from("reports").delete().eq("id", id)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ success: true })
  }

  // POST /admin/ban — delete content and ban user
  if (method === "POST" && path.endsWith("/ban")) {
    const { id } = await req.json()

    const { data: report, error: fetchError } = await ctx.supabaseAdmin
      .from("reports")
      .select("content_type, content_id")
      .eq("id", id)
      .single()

    if (fetchError || !report) {
      return Response.json({ error: "Report not found" }, { status: 404 })
    }

    // Determine the user who owns the flagged content
    const table = report.content_type === "post" ? "posts" : "confessions"
    const { data: content } = await ctx.supabaseAdmin
      .from(table)
      .select("user_id")
      .eq("id", report.content_id)
      .single()

    if (!content?.user_id) {
      return Response.json({ error: "Content owner not found" }, { status: 404 })
    }

    // Ban the user
    await ctx.supabaseAdmin
      .from("profiles")
      .update({ banned: true })
      .eq("id", content.user_id)

    // Delete the report
    await ctx.supabaseAdmin.from("reports").delete().eq("id", id)

    return Response.json({ success: true, banned_user: content.user_id })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
})
