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

  // GET — list pending users
  if (req.method === "GET") {
    try {
      const { data: profiles, error } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, department, year, created_at, verification_status")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const users = await Promise.all(
        (profiles ?? []).map(async (profile) => {
          let photoUrl = null;
          for (const ext of ["jpg", "jpeg", "png", "pdf"]) {
            try {
              const { data: d } = await supabaseAdmin.storage
                .from("student-id-verification")
                .createSignedUrl(`${profile.id}/student_id.${ext}`, 3600);
              if (d?.signedUrl) {
                photoUrl = d.signedUrl;
                break;
              }
            } catch {
              // Try next extension
            }
          }
          return { ...profile, student_id_photo: photoUrl };
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

  // POST — approve or reject
  if (req.method === "POST") {
    try {
      const { action, user_id, email, name } = await req.json();

      if (!action || !user_id || !email || !name) {
        return Response.json({ error: "Missing fields" }, { headers, status: 400 });
      }

      if (action !== "approve" && action !== "reject") {
        return Response.json({ error: "Invalid action" }, { headers, status: 400 });
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
        const body =
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
              text: body,
            }),
          });
        } catch {
          // Email failure is non-critical
        }
      }

      return Response.json({ success: true, action, user_id }, { headers, status: 200 });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Action failed" },
        { headers, status: 500 }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { headers, status: 405 });
});
