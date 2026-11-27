/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { admin, runIngest, tokenOk } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const db = admin();
  const secret = process.env.CRON_SECRET;
  const isCron = secret ? req.headers.get("authorization") === `Bearer ${secret}` : (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!isCron && !(await tokenOk(db, req))) return new Response("Unauthorized", { status: 401 });
  const { data: run } = await db.from("job_runs").insert({ job: "nightly" }).select("id").single();
  try {
    const res = await runIngest(db);
    revalidatePath("/");
    revalidatePath("/stats-lab");
    if (run?.id) await db.from("job_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail: JSON.stringify(res.counts) }).eq("id", run.id);
    return Response.json({ ok: true, ...res });
  } catch (e: any) {
    if (run?.id) await db.from("job_runs").update({ status: "failed", finished_at: new Date().toISOString(), detail: String(e?.message ?? e) }).eq("id", run.id);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
