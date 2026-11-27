/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { xMe } from "@/lib/x";

export const dynamic = "force-dynamic";

// Read-only check that the X keys work and which account they post as. Posts nothing.
export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhphrklhfkvlecaeyaox.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const token = new URL(req.url).searchParams.get("token");
  if (!key || !token) return new Response("Unauthorized", { status: 401 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.from("job_tokens").select("token").eq("token", token).maybeSingle();
  if (!data) return new Response("Unauthorized", { status: 401 });
  try {
    const me = await xMe();
    return Response.json({
      ok: me.status === 200,
      status: me.status,
      username: me.body?.data?.username ?? null,
      access_level: me.accessLevel,
      error: me.status === 200 ? null : me.body,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
