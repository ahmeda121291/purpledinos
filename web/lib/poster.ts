/* eslint-disable @typescript-eslint/no-explicit-any */
import { CardType, getCard } from "./cards";
import { getNextGame, getRecentFinal } from "./feeds";
import { runIngest } from "./ingest";
import { xPost, xUploadImage } from "./x";
import { playerHref, utm } from "./slug";
import { overUnder, careerHighs } from "./social";

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

// X charges $0.20 for a post with a link (vs $0.015), so only one link reply a day,
// on the post most likely to get clicks. Every card already shows purpledinos.ca.
const LINK_PRIORITY: Partial<Record<CardType, number>> = { gradesopen: 1, growth: 2, tracker: 2, record: 3, reveal: 4 };
function linkReply(type: CardType, card: any): string | null {
  switch (type) {
    case "gradesopen": return `Grade every Raptor here. Results drop tomorrow at noon 👇\n${utm("/grades", "gradesopen")}`;
    case "record": return `${card.data.lead.full_name}'s full Raptors résumé 👇\n${utm(playerHref(card.data.lead.full_name), "record")}`;
    case "tracker": return `Every Raptors season ranked, any stat 👇\n${utm("/stats-lab?tab=best", "tracker")}`;
    case "growth": return `Chart any Raptor's career, any stat 👇\n${utm("/stats-lab?tab=progress", "growth")}`;
    case "reveal": return `More rabbit holes like this 👇\n${utm("/stats-lab", "trivia")}`;
    default: return null;
  }
}
const COST = { post: 0.015, link: 0.2 };

async function monthSpend(db: any) {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const { data } = await db.from("x_posts").select("cost").gte("posted_at", start.toISOString());
  return ((data as any[]) ?? []).reduce((a, r) => a + Number(r.cost ?? 0), 0);
}
async function budget(db: any) {
  const { data } = await db.from("app_settings").select("value").eq("key", "x_budget_month").maybeSingle();
  return Number(data?.value ?? 20) || 20;
}
async function linkUsedToday(db: any, date: string) {
  const { data } = await db.from("x_posts").select("id").gte("created_at", `${date}T05:00:00Z`).eq("payload->>linked", "true").limit(1);
  return Boolean(data?.length);
}

const MAX_ATTEMPTS = 3;
async function existing(db: any, key: string) {
  const { data } = await db.from("x_posts").select("id, status, attempts, caption, image_url, post_type, payload").eq("dedupe_key", key).maybeSingle();
  return data as any;
}
// Skip a key if it was already made, unless it failed and still has retries left (live mode only).
const done = (row: any, mode: string) => row && !(mode === "live" && row.status === "failed" && Number(row.attempts) < MAX_ATTEMPTS);

async function publish(db: any, row: any, log: string[], opts: { allowLink: boolean }) {
  const attempts = Number(row.attempts ?? 0) + 1;
  const p = row.payload ?? {};
  let cost = 0;
  try {
    let mediaIds: string[] | undefined;
    if (row.image_url) {
      const img = await fetch(row.image_url, { cache: "no-store", redirect: "follow" });
      if (!img.ok) throw new Error(`card image ${img.status}`);
      mediaIds = [await xUploadImage(await img.arrayBuffer())];
    }
    // A text-only post can carry its own poll (trivia); image posts get the poll as a reply.
    const ownPoll = !row.image_url && p.poll ? p.poll : undefined;
    const posted = await xPost(row.caption, mediaIds, p.reply_to ?? undefined, ownPoll);
    cost += COST.post;
    const update: any = { status: "posted", posted_at: new Date().toISOString(), x_post_id: posted.id, attempts, error: null };
    if (row.image_url && p.poll && p.pollText) {
      const pr = await xPost(p.pollText, undefined, posted.id, p.poll).catch((e: any) => { log.push(`poll failed: ${e?.message}`); return null; });
      if (pr) { update.poll_post_id = pr.id; cost += COST.post; }
    }
    const link = opts.allowLink ? linkReply(row.post_type, { data: p }) : null;
    if (link) {
      const r = await xPost(link, undefined, posted.id).catch((e: any) => { log.push(`reply failed: ${e?.message}`); return null; });
      if (r) { update.reply_post_id = r.id; update.payload = { ...p, linked: true }; cost += COST.link; }
    }
    update.cost = cost;
    await db.from("x_posts").update(update).eq("id", row.id);
    log.push(`${row.post_type}: posted ${posted.id} ($${cost.toFixed(3)})`);
  } catch (e: any) {
    await db.from("x_posts").update({ status: "failed", attempts, error: String(e?.message ?? e), cost }).eq("id", row.id);
    log.push(`${row.post_type}: failed (${attempts}/${MAX_ATTEMPTS}) ${e?.message}`);
  }
}

export async function runPoster(db: any, origin: string) {
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "posting_mode").maybeSingle();
  const mode = setting?.value === "live" ? "live" : "preview";
  const t = torontoNow();
  const log: string[] = [];
  const cands: Candidate[] = [];

  // Spend guard: over 80% of the monthly budget means no link replies; over 100% means game posts only.
  const [spent, cap] = await Promise.all([monthSpend(db), budget(db)]);
  const tight = spent >= cap * 0.8, broke = spent >= cap;
  if (broke) log.push(`budget: $${spent.toFixed(2)} of $${cap} spent, game posts only`);

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
  const gameToday = Boolean(next && new Date(next.tipISO).toLocaleDateString("en-CA", { timeZone: TZ }) === t.date);
  if (gameToday && t.hour >= 10) cands.push({ type: "gameday", key: `gameday:${t.date}` });

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
  // Weekly series (one evergreen post a day).
  const wk = Math.floor(Date.parse(t.date) / (7 * 86400000));
  if (t.weekday === "Mon" && t.hour >= 11) cands.push({ type: "report", key: `report:${t.date}` });
  if (t.weekday === "Tue" && t.hour >= 11) cands.push({ type: "timemachine", key: `timemachine:${t.date}` });
  if (t.weekday === "Wed" && t.hour >= 11) cands.push({ type: "lineup", key: `lineup:${t.date}` });
  if (t.weekday === "Thu" && t.hour >= 11) {
    const first: CardType = wk % 2 ? "growth" : "tracker", second: CardType = wk % 2 ? "tracker" : "growth";
    cands.push({ type: first, key: `thu:${t.date}` }, { type: second, key: `thu:${t.date}` });
  }
  if (t.weekday === "Fri" && t.hour >= 11) cands.push({ type: "legends", key: `legends:${t.date}` });
  if (t.weekday === "Sat" && t.hour >= 12) cands.push({ type: "trivia", key: `trivia:${t.date}` });
  if (t.weekday === "Sun" && t.hour >= 12) cands.push({ type: "reveal", key: `reveal:${t.date}` });
  // On This Day fills quiet days only.
  if (t.hour >= 12 && !gameToday) cands.push({ type: "onthisday", key: `onthisday:${t.date}` });

  const CORE = new Set<CardType>(["gameday", "final", "gradesopen", "grades"]);
  const linkFree = !tight && !(await linkUsedToday(db, t.date));
  // On game days the one link is saved for Grades Are Open; other days the first eligible post gets it.
  const gameWindow = gameToday || Boolean(fin) || cands.some((c) => c.type === "gradesopen");
  const allowLink = (type: CardType) => linkFree && Boolean(LINK_PRIORITY[type]) && (type === "gradesopen" || !gameWindow);

  // One post per run, in priority order, so the feed never gets dumped all at once.
  for (const c of cands) {
    if (broke && !CORE.has(c.type)) continue;
    if (c.key) {
      const row = await existing(db, c.key);
      if (done(row, mode)) continue;
      if (row) { await publish(db, row, log, { allowLink: allowLink(c.type) }); break; } // retry a failed live post
    }
    const card = await getCard(c.type).catch(() => null);
    if (!card) { log.push(`${c.type}: no data`); continue; }
    const key = c.check ? c.check(card) : c.key;
    if (!key) { log.push(`${c.type}: below threshold`); continue; }
    if (c.check) {
      const row = await existing(db, key);
      if (done(row, mode)) continue;
      if (row) { await publish(db, row, log, { allowLink: allowLink(c.type) }); break; }
    }

    // Extras: polls, over/under, career highs, trivia threading.
    const payload: any = { ...card.data };
    let caption = card.caption;
    if (card.poll) { payload.poll = card.poll; if (card.pollText) payload.pollText = card.pollText; }
    if (c.type === "gameday") {
      const ou = await overUnder().catch(() => null);
      if (ou) { payload.ou = { player: ou.player, line: ou.line }; payload.poll = ou.poll; payload.pollText = ou.text; }
    }
    if (c.type === "final") {
      const gid = key.slice(6);
      const { data: g } = await db.from("games").select("game_date").eq("game_id", gid).maybeSingle();
      const { data: gd } = g ? await db.from("x_posts").select("payload").eq("dedupe_key", `gameday:${g.game_date}`).maybeSingle() : { data: null };
      const ou = (gd as any)?.payload?.ou;
      if (ou) {
        const { data: b } = await db.from("v_player_games").select("pts").eq("game_id", gid).eq("full_name", ou.player).maybeSingle();
        if (b) caption += ` O/U: ${ou.player.split(" ").pop()} had ${b.pts} (line ${ou.line}) ${Number(b.pts) > ou.line ? "✅ over" : "❌ under"}.`;
      }
      const highs = await careerHighs(gid).catch(() => [] as string[]);
      if (highs.length) caption += ` 🔥 Raptors career high: ${highs.join(", ")}.`;
    }
    if (c.type === "reveal") {
      const sat = new Date(Date.parse(t.date) - 86400000).toISOString().slice(0, 10);
      const { data: tv } = await db.from("x_posts").select("x_post_id").eq("dedupe_key", `trivia:${sat}`).maybeSingle();
      if ((tv as any)?.x_post_id) payload.reply_to = (tv as any).x_post_id;
    }

    const image_url = c.type === "trivia" ? null : card.image ?? `${origin}/api/card/${c.type}?v=${Date.now()}`;
    const { data: row, error } = await db.from("x_posts").insert({
      post_type: c.type, payload, caption, image_url,
      status: mode === "live" ? "queued" : "preview", dedupe_key: key, scheduled_for: new Date().toISOString(),
    }).select("id, caption, image_url, post_type, payload, attempts").single();
    if (error) { log.push(`${c.type}: ${error.message}`); continue; }

    if (mode === "live") await publish(db, row, log, { allowLink: allowLink(c.type) });
    else log.push(`${c.type}: added to preview${payload.poll ? " (with poll)" : ""}`);
    break;
  }
  return { mode, toronto: t, log };
}
