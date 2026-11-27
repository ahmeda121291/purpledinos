/* eslint-disable @typescript-eslint/no-explicit-any */
import { CardType, getCard } from "./cards";
import { getNextGame, getRecentFinal } from "./feeds";
import { runIngest } from "./ingest";
import { xPost, xUploadImage } from "./x";

const TZ = "America/Toronto";
function torontoNow() {
  const d = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday as string };
}

// How close a Record Watch chase must be before it's worth a post.
const RECORD_THRESHOLD: Record<string, number> = { points: 30, rebounds: 12, assists: 12, steals: 4, blocks: 4, threes: 5, games: 3 };

type Candidate = { type: CardType; key: string; check?: (card: any) => string | null };

async function exists(db: any, key: string) {
  const { data } = await db.from("x_posts").select("id").eq("dedupe_key", key).maybeSingle();
  return Boolean(data);
}

export async function runPoster(db: any, origin: string) {
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "posting_mode").maybeSingle();
  const mode = setting?.value === "live" ? "live" : "preview";
  const t = torontoNow();
  const log: string[] = [];
  const cands: Candidate[] = [];

  // Final: within ~10h of the buzzer. Pull the game first if the nightly job hasn't yet.
  const fin = await getRecentFinal();
  if (fin) {
    const { data: g } = await db.from("games").select("game_id, game_date").order("game_date", { ascending: false }).limit(1).maybeSingle();
    if (!g || g.game_date < fin.dateET) {
      log.push("final: pulling game data");
      await runIngest(db, { budgetMs: 30000 }).catch((e: any) => log.push("ingest failed: " + e?.message));
    }
    const { data: g2 } = await db.from("games").select("game_id, game_date").order("game_date", { ascending: false }).limit(1).maybeSingle();
    if (g2 && g2.game_date === fin.dateET) cands.push({ type: "final", key: `final:${g2.game_id}` });
    else log.push("final: game not in database yet");
  }

  const next = await getNextGame();
  if (next && new Date(next.tipISO).toLocaleDateString("en-CA", { timeZone: TZ }) === t.date && t.hour >= 10)
    cands.push({ type: "gameday", key: `gameday:${t.date}` });

  if (t.hour >= 14) {
    const { count } = await db.from("x_posts").select("id", { count: "exact", head: true }).eq("post_type", "record").gte("created_at", `${t.date}T00:00:00-05:00`);
    if (!count) cands.push({
      type: "record", key: "",
      check: (card) => {
        const r = card.data.lead;
        if (Number(r.gap) > (RECORD_THRESHOLD[r.category] ?? 0)) return null;
        return `record:${r.full_name}:${r.category}:${r.next_name}`;
      },
    });
  }
  if (t.weekday === "Mon" && t.hour >= 11) cands.push({ type: "report", key: `report:${t.date}` });
  if (t.weekday === "Wed" && t.hour >= 11) cands.push({ type: "lineup", key: `lineup:${t.date}` });
  if (t.weekday === "Fri" && t.hour >= 11) cands.push({ type: "legends", key: `legends:${t.date}` });
  if (t.hour >= 12) cands.push({ type: "onthisday", key: `onthisday:${t.date}` });

  // One post per run, in priority order, so the feed never gets dumped all at once.
  for (const c of cands) {
    if (c.key && (await exists(db, c.key))) continue;
    const card = await getCard(c.type).catch(() => null);
    if (!card) { log.push(`${c.type}: no data`); continue; }
    const key = c.check ? c.check(card) : c.key;
    if (!key) { log.push(`${c.type}: below threshold`); continue; }
    if (c.check && (await exists(db, key))) continue;

    const image_url = `${origin}/api/card/${c.type}?v=${Date.now()}`;
    const { data: row, error } = await db.from("x_posts").insert({
      post_type: c.type, payload: card.data, caption: card.caption, image_url,
      status: mode === "live" ? "queued" : "preview", dedupe_key: key, scheduled_for: new Date().toISOString(),
    }).select("id").single();
    if (error) { log.push(`${c.type}: ${error.message}`); continue; }

    if (mode === "live") {
      try {
        const img = await fetch(image_url, { cache: "no-store" });
        if (!img.ok) throw new Error(`card image ${img.status}`);
        const mediaId = await xUploadImage(await img.arrayBuffer());
        const posted = await xPost(card.caption, [mediaId]);
        await db.from("x_posts").update({ status: "posted", posted_at: new Date().toISOString(), x_post_id: posted.id }).eq("id", row.id);
        log.push(`${c.type}: posted ${posted.id}`);
      } catch (e: any) {
        await db.from("x_posts").update({ status: "failed", error: String(e?.message ?? e) }).eq("id", row.id);
        log.push(`${c.type}: failed ${e?.message}`);
      }
    } else {
      log.push(`${c.type}: added to preview`);
    }
    break;
  }
  return { mode, toronto: t, log };
}
