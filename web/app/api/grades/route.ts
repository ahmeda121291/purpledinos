/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { admin } from "@/lib/ingest";

export const dynamic = "force-dynamic";
const GRADES = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];
const SALT = "pd-grades-v1";
const hash = (s: string) => crypto.createHash("sha256").update(SALT + s).digest("hex").slice(0, 40);
const VOTE_WINDOW_MS = 3 * 86400000;

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}));
  const game_id = String(body.game_id ?? ""), player_id = Number(body.player_id), grade = String(body.grade ?? "");
  if (!game_id || !player_id || !GRADES.includes(grade)) return NextResponse.json({ error: "Bad vote" }, { status: 400 });

  const db = admin();
  const { data: latest } = await db.from("games").select("game_id, game_date").order("game_date", { ascending: false }).limit(1).maybeSingle();
  if (!latest || latest.game_id !== game_id || Date.now() - Date.parse(latest.game_date + "T12:00:00Z") > VOTE_WINDOW_MS)
    return NextResponse.json({ error: "Voting is closed for this game" }, { status: 409 });

  const { data: played } = await db.from("v_player_games").select("player_id").eq("game_id", game_id).eq("player_id", player_id).gt("minutes", 0).maybeSingle();
  if (!played) return NextResponse.json({ error: "He didn't play" }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ip_hash = hash("ip:" + ip);
  const { count } = await db.from("fan_grades").select("player_id", { count: "exact", head: true }).eq("ip_hash", ip_hash).gte("created_at", new Date(Date.now() - 3600000).toISOString());
  if ((count ?? 0) > 120) return NextResponse.json({ error: "Slow down, coach" }, { status: 429 });

  const cookie = req.headers.get("cookie") ?? "";
  let vid = /(?:^|;\s*)pd_vid=([a-f0-9-]{20,})/.exec(cookie)?.[1];
  const fresh = !vid;
  if (!vid) vid = crypto.randomUUID();

  const { error } = await db.from("fan_grades").upsert(
    { game_id, player_id, grade, voter_hash: hash("v:" + vid), ip_hash, created_at: new Date().toISOString() },
    { onConflict: "game_id,player_id,voter_hash" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: rows } = await db.rpc("game_grades", { p_game: game_id });
  const row = ((rows as any[]) ?? []).find((r) => Number(r.player_id) === player_id);
  const res = NextResponse.json({ ok: true, row });
  if (fresh) res.cookies.set("pd_vid", vid, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 400, path: "/" });
  return res;
}
