/* eslint-disable @typescript-eslint/no-explicit-any */
import { admin, tokenOk } from "@/lib/ingest";
import { runFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every 10 minutes by Supabase pg_cron: reads new posts, rescores, maybe reposts one.
export async function GET(req: Request) {
  const db = admin();
  if (!(await tokenOk(db, req))) return new Response("Unauthorized", { status: 401 });
  const { data: run } = await db.from("job_runs").insert({ job: "feed" }).select("id").single();
  try {
    const log = await runFeed(db);
    if (run?.id) await db.from("job_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail: log.join(" | ").slice(0, 900) }).eq("id", run.id);
    return Response.json({ ok: true, log });
  } catch (e: any) {
    if (run?.id) await db.from("job_runs").update({ status: "failed", finished_at: new Date().toISOString(), detail: String(e?.message ?? e) }).eq("id", run.id);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
