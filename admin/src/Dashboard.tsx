import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type ReportWithDetails = {
  id: string;
  content_id: string;
  content_type: "post" | "confession" | "listing";
  reason: string;
  created_at: string;
  reporter: { name: string; email: string } | null;
  content_preview: string | null;
  content_author_id: string | null;
};

export default function Dashboard() {
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      setIsAdmin(false);
      return;
    }

    setIsAdmin(true);
    loadReports();
  };

  const loadReports = async () => {
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("reports")
      .select(
        `
        id,
        content_id,
        content_type,
        reason,
        created_at,
        reporter:reporter_id(name, email)
      `
      )
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Fetch content previews for each report
    const withPreviews: ReportWithDetails[] = [];
    for (const r of data ?? []) {
      let content_preview: string | null = null;
      let content_author_id: string | null = null;

      if (r.content_type === "post") {
        const { data: post } = await supabase
          .from("posts")
          .select("content, user_id")
          .eq("id", r.content_id)
          .maybeSingle();
        content_preview = post?.content ?? "[deleted]";
        content_author_id = post?.user_id ?? null;
      } else if (r.content_type === "confession") {
        const { data: c } = await supabase
          .from("confessions")
          .select("content, user_id")
          .eq("id", r.content_id)
          .maybeSingle();
        content_preview = c?.content ?? "[deleted]";
        content_author_id = c?.user_id ?? null;
      } else if (r.content_type === "listing") {
        const { data: l } = await supabase
          .from("listings")
          .select("title, user_id")
          .eq("id", r.content_id)
          .maybeSingle();
        content_preview = l?.title ?? "[deleted]";
        content_author_id = l?.user_id ?? null;
      }

      withPreviews.push({
        id: r.id,
        content_id: r.content_id,
        content_type: r.content_type,
        reason: r.reason,
        created_at: r.created_at,
        reporter: (r.reporter as unknown as { name: string; email: string }) ?? null,
        content_preview,
        content_author_id,
      });
    }

    setReports(withPreviews);
    setLoading(false);
  };

  const handleDismiss = async (reportId: string) => {
    setActionMsg("");
    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", reportId);

    if (error) {
      setActionMsg(`Error: ${error.message}`);
    } else {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setActionMsg("Report dismissed.");
    }
  };

  const handleDeleteAndBan = async (report: ReportWithDetails) => {
    setActionMsg("");

    if (!report.content_author_id) {
      setActionMsg("Cannot ban: content author not found.");
      return;
    }

    // 1. Delete the content
    const tableMap: Record<string, string> = {
      post: "posts",
      confession: "confessions",
      listing: "listings",
    };
    const table = tableMap[report.content_type];
    if (!table) return;

    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .eq("id", report.content_id);

    if (delErr) {
      setActionMsg(`Error deleting content: ${delErr.message}`);
      return;
    }

    // 2. Ban the user
    const { error: banErr } = await supabase
      .from("profiles")
      .update({ banned: true })
      .eq("id", report.content_author_id);

    if (banErr) {
      setActionMsg(`Error banning user: ${banErr.message}`);
      return;
    }

    // 3. Delete the report
    await supabase.from("reports").delete().eq("id", report.id);

    setReports((prev) => prev.filter((r) => r.id !== report.id));
    setActionMsg("Content deleted and user banned.");
  };

  if (isAdmin === false) {
    return (
      <div style={center}>
        <p style={{ color: "#ff4444" }}>
          You do not have admin access.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={center}>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1>CampusVibe Admin</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>

      {error && (
        <p style={{ color: "#ff4444", marginBottom: 16 }}>{error}</p>
      )}
      {actionMsg && (
        <p
          style={{
            color: actionMsg.startsWith("Error") ? "#ff4444" : "#208AEF",
            marginBottom: 16,
          }}
        >
          {actionMsg}
        </p>
      )}

      {reports.length === 0 ? (
        <p style={{ color: "#666" }}>No reports to review.</p>
      ) : (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Type</th>
              <th style={th}>Content</th>
              <th style={th}>Reason</th>
              <th style={th}>Reporter</th>
              <th style={th}>Date</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.content_type}</td>
                <td style={td}>
                  <div style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.content_preview ?? "—"}
                  </div>
                </td>
                <td style={td}>{r.reason}</td>
                <td style={td}>{r.reporter?.name ?? "Unknown"}</td>
                <td style={td}>
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleDismiss(r.id)}
                      style={dismissBtn}
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleDeleteAndBan(r)}
                      disabled={!r.content_author_id}
                      style={deleteBtn}
                    >
                      Delete & Ban
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const center: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  borderBottom: "2px solid #eee",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};

const dismissBtn: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  border: "1px solid #ddd",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
};

const deleteBtn: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  border: "1px solid #ff4444",
  borderRadius: 4,
  background: "#ff4444",
  color: "#fff",
  cursor: "pointer",
};
