import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SB_ANON_KEY") ?? "";
const supabaseSecret = Deno.env.get("SB_SECRET_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseSecret);

Deno.serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers, status: 204 });
  }

  // Verify JWT and admin status
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing authorization" }, { headers, status: 401 });
  }

  const jwt = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Invalid token" }, { headers, status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return Response.json({ error: "Not authorized" }, { headers, status: 403 });
  }

  // GET
  if (req.method === "GET") {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");

    if (scope === "dashboard") {
      return handleDashboard(supabaseAdmin, headers);
    }

    // Existing: list pending users
    try {
      const { data: profiles, error } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, department, year, created_at, verification_status")
        .or("verification_status.is.null,verification_status.eq.pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const users = await Promise.all(
        (profiles ?? []).map(async (profile) => {
          let photoUrl = null;
          let debug: any = {};
          try {
            const { data: files, error: listError } = await supabaseAdmin.storage
              .from("student-id-verification")
              .list(profile.id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
            debug.listSDK = { files: files?.length ?? 0, error: listError?.message ?? null };
            if (files && files.length > 0) {
              const { data: sd } = await supabaseAdmin.storage
                .from("student-id-verification")
                .createSignedUrl(`${profile.id}/${files[0].name}`, 3600);
              debug.signSDK = sd ? "ok" : "null";
              if (sd?.signedUrl) {
                photoUrl = sd.signedUrl;
              }
            }
            if (!photoUrl) {
              const listRes = await fetch(
                `${supabaseUrl}/storage/v1/object/list/student-id-verification`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: supabaseAnonKey,
                    authorization: `Bearer ${supabaseSecret}`,
                  },
                  body: JSON.stringify({
                    prefix: `${profile.id}/`,
                    limit: 10,
                    sortBy: { column: "created_at", order: "desc" },
                  }),
                }
              );
              debug.listStatus = listRes.status;
              if (listRes.ok) {
                const resFiles = await listRes.json();
                debug.restFileCount = resFiles.length;
                if (resFiles.length > 0) {
                  const signRes = await fetch(
                    `${supabaseUrl}/storage/v1/object/sign/student-id-verification/${profile.id}/${resFiles[0].name}`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        apikey: supabaseAnonKey,
                        authorization: `Bearer ${supabaseSecret}`,
                      },
                      body: JSON.stringify({ expiresIn: 3600 }),
                    }
                  );
                  debug.signStatus = signRes.status;
                  if (signRes.ok) {
                    const signData = await signRes.json();
                    photoUrl = signData.signedURL ?? signData.signedUrl;
                  }
                }
              } else {
                debug.listError = await listRes.text();
              }
            }
          } catch (e) {
            debug.error = String(e);
          }
          return { ...profile, student_id_photo: photoUrl, _debug: debug };
        })
      );

      return Response.json({ users }, { headers, status: 200 });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : String(e) },
        { headers, status: 500 }
      );
    }
  }

  // POST — approve, reject, dismiss_report, remove_content
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { action } = body;

      if (action === "approve" || action === "reject") {
        const { user_id, email, name } = body;
        if (!user_id || !email || !name) {
          return Response.json({ error: "Missing fields" }, { headers, status: 400 });
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        const { error: dbError } = await supabaseAdmin
          .from("profiles")
          .update({ verification_status: newStatus })
          .eq("id", user_id);

        if (dbError) throw dbError;

        // Log to admin_actions audit table
        const { error: logError } = await supabaseAdmin
          .from("admin_actions")
          .insert({
            admin_email: profile.email,
            action: action === "approve" ? "approved" : "rejected",
            target_user_id: user_id,
          });

        if (logError) {
          console.error("Failed to log admin action:", logError);
        }

        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const subject =
            action === "approve"
              ? "You're verified! Welcome to CampusVibe 🎉"
              : "Student ID verification issue";
          const innerBody =
            action === "approve"
              ? `Hi ${name},\n\nGreat news! Your student ID has been verified. You can now post, message, and fully participate in CampusVibe.\n\nWelcome aboard! 🎉\n\n- The CampusVibe Team`
              : `Hi ${name},\n\nUnfortunately, your student ID could not be verified. This might be because the photo was blurry or incomplete.\n\nPlease open the app and re-upload a clearer photo of your student ID card.\n\n- The CampusVibe Team`;

          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "CampusVibe <noreply@campusvibe.app>",
                to: [email],
                subject,
                text: innerBody,
              }),
            });
          } catch {
            // Email failure is non-critical
          }
        }

        return Response.json({ success: true, action, user_id }, { headers, status: 200 });
      }

      if (action === "dismiss_report") {
        const { report_id } = body;
        if (!report_id) {
          return Response.json({ error: "Missing report_id" }, { headers, status: 400 });
        }

        // Look up the report to get content_id + content_type,
        // then dismiss ALL reports for that content
        const { data: report, error: fetchError } = await supabaseAdmin
          .from("reports")
          .select("content_id, content_type")
          .eq("id", report_id)
          .single();

        if (fetchError || !report) {
          return Response.json({ error: "Report not found" }, { headers, status: 404 });
        }

        const { error: delError } = await supabaseAdmin
          .from("reports")
          .delete()
          .eq("content_id", report.content_id)
          .eq("content_type", report.content_type);

        if (delError) throw delError;

        return Response.json({ success: true, action, report_id }, { headers, status: 200 });
      }

      if (action === "remove_content") {
        const { report_id } = body;
        if (!report_id) {
          return Response.json({ error: "Missing report_id" }, { headers, status: 400 });
        }

        // Fetch report to find content_id and content_type
        const { data: report, error: fetchError } = await supabaseAdmin
          .from("reports")
          .select("content_id, content_type")
          .eq("id", report_id)
          .single();

        if (fetchError || !report) {
          return Response.json({ error: "Report not found" }, { headers, status: 404 });
        }

        // Delete content from the appropriate table
        const tableMap: Record<string, string> = {
          post: "posts",
          confession: "confessions",
          listing: "listings",
        };
        const table = tableMap[report.content_type];
        if (table) {
          const { error: contentError } = await supabaseAdmin
            .from(table)
            .delete()
            .eq("id", report.content_id);

          if (contentError) throw contentError;
        }

        // Delete the report(s) for this content
        const { error: delError } = await supabaseAdmin
          .from("reports")
          .delete()
          .eq("content_id", report.content_id)
          .eq("content_type", report.content_type);

        if (delError) throw delError;

        return Response.json({ success: true, action, report_id }, { headers, status: 200 });
      }

      return Response.json({ error: "Invalid action" }, { headers, status: 400 });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Action failed" },
        { headers, status: 500 }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { headers, status: 405 });
});

// ── Dashboard data endpoint ──────────────────────────────────
async function handleDashboard(supabaseAdmin: any, headers: Record<string, string>) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    // 1. Analytics counts (parallel)
    const [
      { count: totalUsers },
      { count: pendingCount },
      { count: dailyPosts },
      { count: dailyMessages },
      { count: reportCount },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).or("verification_status.is.null,verification_status.eq.pending"),
      supabaseAdmin.from("posts").select("*", { count: "exact", head: true }).gte("created_at", todayIso),
      supabaseAdmin.from("messages").select("*", { count: "exact", head: true }).gte("created_at", todayIso),
      supabaseAdmin.from("reports").select("*", { count: "exact", head: true }),
    ]);

    // 2. All users for the user management table
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, department, year, verification_status, created_at, is_admin, banned")
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;

    // 3. Reports for the moderation queue
    const { data: reports, error: reportsError } = await supabaseAdmin
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (reportsError) throw reportsError;

    // Group reports by content_id to get flag counts
    const reportGroups: Record<string, any> = {};
    for (const r of reports ?? []) {
      const key = `${r.content_type}:${r.content_id}`;
      if (!reportGroups[key]) {
        reportGroups[key] = { ...r, flag_count: 0 };
      }
      reportGroups[key].flag_count++;
    }

    // Collect content IDs to fetch
    const grouped: Record<string, string[]> = { post: [], confession: [], listing: [] };
    for (const r of Object.values(reportGroups)) {
      if (grouped[r.content_type]) {
        grouped[r.content_type].push(r.content_id);
      }
    }

    // Fetch content details in parallel
    const [postRes, confessionRes, listingRes] = await Promise.all([
      supabaseAdmin.from("posts").select("id, user_id, content").in("id", grouped.post),
      supabaseAdmin.from("confessions").select("id, user_id, content").in("id", grouped.confession),
      supabaseAdmin.from("listings").select("id, user_id, title").in("id", grouped.listing),
    ]);

    // Build content lookup
    const contentMap: Record<string, any> = {};
    for (const row of postRes.data ?? []) contentMap[`post:${row.id}`] = row;
    for (const row of confessionRes.data ?? []) contentMap[`confession:${row.id}`] = row;
    for (const row of listingRes.data ?? []) contentMap[`listing:${row.id}`] = row;

    // Fetch author names
    const authorIds = [...new Set(
      Object.values(contentMap).map((c: any) => c.user_id).filter(Boolean)
    )];
    const { data: authors } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", authorIds);

    const authorNames: Record<string, string> = {};
    for (const a of authors ?? []) authorNames[a.id] = a.name;

    // Enrich reports with content excerpt and author name
    const enrichedReports = Object.values(reportGroups).map((r: any) => {
      const key = `${r.content_type}:${r.content_id}`;
      const content = contentMap[key];
      const raw = content?.content || content?.title || "";
      const excerpt = raw.substring(0, 120);
      const isAnonymous = r.content_type === "confession";
      const authorId = content?.user_id;
      return {
        id: r.id,
        content_id: r.content_id,
        content_type: r.content_type,
        content_excerpt: excerpt,
        flag_count: r.flag_count,
        reason: r.reason,
        author_name: isAnonymous ? "Anonymous" : (authorId ? authorNames[authorId] || "Unknown" : "Unknown"),
        author_id: authorId,
        created_at: r.created_at,
      };
    });

    // 4. Get student ID photos for pending users (for the review modal)
    const pendingUsers = (allUsers ?? []).filter(
      (u: any) => !u.verification_status || u.verification_status === "pending"
    );

    const pendingWithPhotos = await Promise.all(
      pendingUsers.map(async (u: any) => {
        let photoUrl = null;
        try {
          const { data: files } = await supabaseAdmin.storage
            .from("student-id-verification")
            .list(u.id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
          if (files?.length > 0) {
            const { data: sd } = await supabaseAdmin.storage
              .from("student-id-verification")
              .createSignedUrl(`${u.id}/${files[0].name}`, 3600);
            photoUrl = sd?.signedUrl ?? null;
          }
        } catch {}
        return { ...u, student_id_photo: photoUrl };
      })
    );

    // Merge photos back into all users
    const photoMap: Record<string, string | null> = {};
    for (const pu of pendingWithPhotos) photoMap[pu.id] = pu.student_id_photo;
    const allUsersWithPhotos = (allUsers ?? []).map((u: any) => ({
      ...u,
      student_id_photo: photoMap[u.id] || null,
    }));

    return Response.json({
      analytics: {
        totalUsers: totalUsers ?? 0,
        pendingVerifications: pendingCount ?? 0,
        dailyEngagement: (dailyPosts ?? 0) + (dailyMessages ?? 0),
        totalReports: reportCount ?? 0,
      },
      users: allUsersWithPhotos,
      reports: enrichedReports,
    }, { headers, status: 200 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { headers, status: 500 }
    );
  }
}
