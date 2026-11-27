/* eslint-disable @typescript-eslint/no-explicit-any */
import { CardType, getCard } from "./cards";
import { getNextGame, getRecentFinal } from "./feeds";
import { runIngest } from "./ingest";
import { xPost, xUploadImage } from "./x";
import { playerHref, utm } from "./slug";

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

// Links go in a reply, not the main post, so the card itself gets full reach.
function replyFor(type: CardType, card: any): string | null {
  switch (type) {
    case "final": return `Grade the boys 🦖👇\n${utm("/grades", "final")}`;
    case "gradesopen": return `Grade them here. Results drop tomorrow at noon 👇\n${utm("/grades", "gradesopen")}`;
    case "grades": return `Full report card, and your vote 👇\n${utm("/grades", "grades")}`;
    case "record": return `${card.data.lead.full_name}'s full Raptors résumé 👇\n${utm(playerHref(card.data.lead.full_name), "record")}`;
    case "report": return `Every Raptor's numbers, filter it however you want 👇\n${utm("/stats-lab", "report")}`;
    case "lineup": return `Every lineup since 2007, filterable 👇\n${utm("/stats-lab?tab=lineups", "lineup")}`;
    case "legends": return `Run your own comparison 👇\n${utm("/stats-lab?tab=compare", "legends")}`;
    case "gameday": return `Who's hot, who's not, and tonight's preview 👇\n${utm("/", "gameday")}`;
    default: return null;
  }
}

const MAX_ATTEMPTS = 3;
async function existing(db: any, key: string) {
  const { data } = await db.from("x_posts").select("id, status, attempts, caption, image_url, post_type, payload").eq("dedupe_key", key).maybeSingle();
  return data as any;
}
// Skip a key if it was already made, unless it failed and still has retries left (live mode only).
const done = (row: any, mode: string) => row && !(mode === "live" && row.status === "failed" && Number(row.attempts) < MAX_ATTEMPTS);

async function publish(db: any, row: any, log: string[]) {
  const attempts = Number(row.attempts ?? 0) + 1;
  try {
    const img = await fetch(row.image_url, { cache: "no-store" });
    if (!img.ok) throw new Error(`card image ${img.status}`);
    const mediaId = await xUploadImage(await img.arrayBuffer());
    const posted = await xPost(row.caption, [mediaId]);
    await db.from("x_posts").update({ status: "posted", posted_at: new Date().toISOString(), x_post_id: posted.id, attempts, error: null }).eq("id", row.id);
    const reply = replyFor(row.post_type, { data: row.payload });
    if (reply) {
      const r = await xPost(reply, undefined, posted.id).catch((e: any) => { log.push(`reply failed: ${e?.message}`); return null; });
      if (r) await db.from("x_posts").update({ reply_post_id: r.id }).eq("id", row.id);
    }
    log.push(`${row.post_type}: posted ${posted.id}`);
  } catch (e: any) {
    await db.from("x_posts").update({ status: "failed", attempts, error: String(e?.message ?? e) }).eq("id", row.id);
    log.push(`${row.post_type}: failed (${attempts}/${MAX_ATTEMPTS}) ${e?.message}`);
  }
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

  // Grades are open: a standalone call to vote, 30 min to 6 h after the Final went out.
  const { data: fp } = await db.from("x_posts").select("dedupe_key, created_at, posted_at, status").like("dedupe_key", "final:%").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (fp && fp.status !== "failed") {
    const age = Date.now() - Date.parse(fp.posted_at ?? fp.created_at);
    if (age >= 30 * 60000 && age < 6 * 3600000) cands.push({ type: "gradesopen", key: `gradesopen:${String(fp.dedupe_key).slice(6)}` });
  }

  const next = await getNextGame();
  if (next && new Date(next.tipISO).toLocaleDateString("en-CA", { timeZone: TZ }) === t.date && t.hour >= 10)
    cands.push({ type: "gameday", key: `gameday:${t.date}` });

  // Jurassic Park Grades: noon the day after a game (fans vote overnight).
  if (t.hour >= 12) {
    const { data: lg } = await db.from("games").select("game_id, game_date").order("game_date", { ascending: false }).limit(1).maybeSingle();
    if (lg && lg.game_date < t.date && (Date.parse(t.date) - Date.parse(lg.game_date)) <= 2 * 86400000)
      cands.push({ type: "grades", key: `grades:${lg.game_id}` });
  }

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
    if (c.key) {
      const row = await existing(db, c.key);
      if (done(row, mode)) continue;
      if (row) { await publish(db, row, log); break; } // retry a failed live post
    }
    const card = await getCard(c.type).catch(() => null);
    if (!card) { log.push(`${c.type}: no data`); continue; }
    const key = c.check ? c.check(card) : c.key;
    if (!key) { log.push(`${c.type}: below threshold`); continue; }
    if (c.check) {
      const row = await existing(db, key);
      if (done(row, mode)) continue;
      if (row) { await publish(db, row, log); break; }
    }

    const image_url = `${origin}/api/card/${c.type}?v=${Date.now()}`;
    const { data: row, error } = await db.from("x_posts").insert({
      post_type: c.type, payload: card.data, caption: card.caption, image_url,
      status: mode === "live" ? "queued" : "preview", dedupe_key: key, scheduled_for: new Date().toISOString(),
    }).select("id, caption, image_url, post_type, payload, attempts").single();
    if (error) { log.push(`${c.type}: ${error.message}`); continue; }

    if (mode === "live") await publish(db, row, log);
    else log.push(`${c.type}: added to preview`);
    break;
  }
  return { mode, toronto: t, log };
}
