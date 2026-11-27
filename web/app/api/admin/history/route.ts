import { NextResponse } from "next/server";
import { admin, tokenOk } from "@/lib/ingest";
import { syncHistory, syncRoster } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-time (and repeatable) backfill of league averages and player ages: ?from=1995&to=2003
export async function GET(req: Request) {
  const db = admin();
  if (!(await tokenOk(db, req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const from = Number(q.get("from") || 1995), to = Number(q.get("to") || 2026);
  const roster = q.get("roster") ? await syncRoster(db).catch((e) => String(e)) : null;
  const done = await syncHistory(db, from, to);
  return NextResponse.json({ ok: true, done, roster });
}
