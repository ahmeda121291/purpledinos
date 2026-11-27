/* eslint-disable @typescript-eslint/no-explicit-any */
import { admin, tokenOk } from "@/lib/ingest";
import { runPoster } from "@/lib/poster";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every 15 minutes by Supabase pg_cron. Decides what (if anything) to post right now.
export async function GET(req: Request) {
  const db = admin();
  if (!(await tokenOk(db, req))) return new Response("Unauthorized", { status: 401 });
  const { data: run } = await db.from("job_runs").insert({ job: "poster" }).select("id").single();
  try {
    const res = await runPoster(db, "https://purpledinos.ca");
    if (run?.id) await db.from("job_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail: res.log.join(" | ").slice(0, 900) }).eq("id", run.id);
    return Response.json({ ok: true, ...res });
  } catch (e: any) {
    if (run?.id) await db.from("job_runs").update({ status: "failed", finished_at: new Date().toISOString(), detail: String(e?.message ?? e) }).eq("id", run.id);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
