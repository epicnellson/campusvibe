import { createClient } from "npm:@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

export const fetch = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: CORS_HEADERS })
  }

  let body: { id?: string; email?: string; name?: string; department?: string; year?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  if (!body.id || !body.email) {
    return Response.json({ error: "Missing required fields: id, email" }, { status: 400, headers: CORS_HEADERS })
  }

  const client = createClient(supabaseUrl, supabaseKey)

  const { error } = await client.from("profiles").upsert(
    {
      id: body.id,
      email: body.email,
      name: body.name ?? null,
      department: body.department ?? null,
      year: body.year ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: false }
  )

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS })
  }

  return Response.json({ success: true }, { headers: CORS_HEADERS })
}
