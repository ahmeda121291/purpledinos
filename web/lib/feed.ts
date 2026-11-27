/* eslint-disable @typescript-eslint/no-explicit-any */
// Raptors Twitter feed: reads original posts from a hand-picked list of writers and
// podcasters, shows them on /feed, and reposts the best 2-3 a day on @PurpleDinosTO.
// X bills $0.005 per post read, so every read is capped and written to x_usage.
import { currentSeason } from "./nba";
import { xGet, xMe, xRepost } from "./x";
import { getNextGame, getRecentFinal } from "./feeds";

const READ = 0.005, USER_READ = 0.01, REPOST = 0.015;
const TZ = "America/Toronto";

const setting = async (db: any, key: string, dflt: string) => {
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? dflt;
};
const setSetting = (db: any, key: string, value: string) => db.from("app_settings").upsert({ key, value });
const utcMidnight = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const monthStart = () => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const log = (db: any, kind: string, units: number, cost: number) => (units ? db.from("x_usage").insert({ kind, units, cost }) : null);

export async function monthSpendAll(db: any) {
  const since = monthStart();
  const [{ data: a }, { data: b }] = await Promise.all([
    db.from("x_posts").select("cost").gte("posted_at", since),
    db.from("x_usage").select("cost").gte("at", since),
  ]);
  const sum = (r: any[] | null) => (r ?? []).reduce((s, x) => s + Number(x.cost ?? 0), 0);
  return sum(a) + sum(b);
}

/* ---------- accounts ---------- */
async function syncAccounts(db: any, out: string[]) {
  const week = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data } = await db.from("feed_accounts").select("handle, user_id, checked_at").eq("active", true);
  const due = ((data as any[]) ?? []).filter((a) => !a.user_id || !a.checked_at || a.checked_at < week).map((a) => a.handle);
  if (!due.length) return;
  for (let i = 0; i < due.length; i += 100) {
    const batch = due.slice(i, i + 100);
    const body = await xGet("/2/users/by", { usernames: batch.join(","), "user.fields": "profile_image_url,verified,name" });
    const users = (body.data as any[]) ?? [];
    await log(db, "feed_users", users.length, users.length * USER_READ);
    const now = new Date().toISOString();
    for (const u of users) {
      await db.from("feed_accounts").update({
        user_id: u.id, name: u.name, verified: Boolean(u.verified), status: "ok", checked_at: now,
        avatar_url: String(u.profile_image_url ?? "").replace("_normal.", "_400x400."),
      }).ilike("handle", u.username);
    }
    for (const e of (body.errors as any[]) ?? []) {
      const h = e.value ?? e.resource_id;
      if (h) await db.from("feed_accounts").update({ status: e.title?.includes("Suspended") ? "suspended" : "not_found", checked_at: now }).ilike("handle", h);
    }
    out.push(`accounts: ${users.length} synced, ${(body.errors ?? []).length} not found`);
  }
}

/* ---------- relevance ---------- */
const COMMON = new Set(["Battle", "Walter", "Graves", "Brown", "Martin", "Young", "Jackson", "Mitchell", "Johnson", "Murray"]);
async function raptorsMatcher(db: any) {
  const { data } = await db.from("v_player_games").select("full_name").eq("season_id", currentSeason()).limit(2000);
  const names = [...new Set(((data as any[]) ?? []).map((r) => r.full_name))];
  const full = names.map((n) => n.toLowerCase());
  const last = names.map((n) => n.split(" ").slice(-1)[0]).filter((l) => l.length > 3);
  const loose = /raptors|\b(raps|we the north|wethenorth|darko|scotiabank arena|jurassic park|905)\b/i;
  // The same idea as an X search clause, so off-topic posts are never read (or billed).
  const terms = ["raptors", "#raptors", "raps", "#WeTheNorth", "\"we the north\"", "darko", "905", "url:raptors",
    ...[...new Set(last.filter((l) => !COMMON.has(l)))].map((l) => (/[^A-Za-z]/.test(l) ? `"${l}"` : l))];
  const clause = `(${terms.join(" OR ")})`;
  const test = (t: string) => {
    if (loose.test(t)) return true;
    const lo = t.toLowerCase();
    if (full.some((n) => lo.includes(n))) return true;
    // Last names alone: must be capitalised, and common words need a full-name or team hit (handled above).
    return last.some((l) => !COMMON.has(l) && new RegExp(`\\b${l}\\b`).test(t));
  };
  return { test, clause };
}

/* ---------- game rhythm ---------- */
// The feed follows the schedule: busiest while the Raptors are playing, quiet when they aren't.
export type FeedMode = "live" | "postgame" | "gameday" | "offday" | "quiet";
const POLICY: Record<FeedMode, { perDay: number; gapMin: number; ageMin: number; minScore: number; reads: number }> = {
  live:     { perDay: 6, gapMin: 20,  ageMin: 20, minScore: 1.0, reads: 160 },
  postgame: { perDay: 6, gapMin: 30,  ageMin: 20, minScore: 1.0, reads: 160 },
  gameday:  { perDay: 6, gapMin: 90,  ageMin: 60, minScore: 1.2, reads: 160 },
  offday:   { perDay: 2, gapMin: 180, ageMin: 90, minScore: 1.3, reads: 60 },
  quiet:    { perDay: 1, gapMin: 360, ageMin: 90, minScore: 1.5, reads: 40 },
};
export async function feedMode(): Promise<FeedMode> {
  const now = Date.now();
  const [next, fin] = await Promise.all([getNextGame().catch(() => null), getRecentFinal(72).catch(() => null)]);
  const tip = next ? Date.parse(next.tipISO) : null;
  if (tip && tip <= now) return "live"; // started, not final yet
  const finTip = fin ? Date.parse(fin.tipISO) : null;
  if (finTip && now - finTip < 5 * 3600000) return "postgame"; // roughly 2.5h of game + 2.5h of reaction
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  if (tip && new Date(tip).toLocaleDateString("en-CA", { timeZone: TZ }) === today) return "gameday";
  const soon = tip && tip - now < 72 * 3600000;
  return soon || finTip ? "offday" : "quiet"; // nothing within 3 days either way: off-season, All-Star break
}

/* ---------- ingest ---------- */
function cleanText(t: string, urls: any[], quotedId: string | null) {
  let s = t;
  for (const u of urls) {
    if (!u.url) continue;
    // Media links and the quoted post's own link are shown as media / a quote, not as text.
    const drop = u.media_key || /^pic\.(x|twitter)\.com\//.test(u.display_url ?? "") || /\/(photo|video)\/\d+$/.test(u.expanded_url ?? "") || (quotedId && String(u.expanded_url ?? "").includes(quotedId));
    s = s.split(u.url).join(drop ? "" : u.display_url ?? u.expanded_url);
  }
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+\n/g, "\n").trim();
}

export async function ingestFeed(db: any, mode: FeedMode = "offday") {
  const out: string[] = [];
  const [budgetStr, spent] = await Promise.all([setting(db, "x_budget_month", "25"), monthSpendAll(db)]);
  const cap = POLICY[mode].reads, budget = Number(budgetStr) || 25;
  // Reads stop at 70% of the monthly budget so they can never squeeze out game-day posts.
  if (spent >= budget * 0.7) { out.push(`feed paused: $${spent.toFixed(2)} of $${budget} spent`); return out; }

  await syncAccounts(db, out);
  const { data: used } = await db.from("x_usage").select("units").eq("kind", "feed_posts").gte("at", utcMidnight());
  let remaining = cap - ((used as any[]) ?? []).reduce((s, r) => s + r.units, 0);
  if (remaining <= 0) { out.push(`feed: daily cap of ${cap} reads reached`); return out; }

  const { data: accts } = await db.from("feed_accounts").select("handle, user_id").eq("active", true).eq("status", "ok");
  const handles = ((accts as any[]) ?? []).map((a) => a.handle);
  const byId = new Map(((accts as any[]) ?? []).map((a) => [a.user_id, a.handle]));
  if (!handles.length) { out.push("feed: no accounts"); return out; }
  const { test: isRaps, clause } = await raptorsMatcher(db);

  // Small groups keep each query (handles + Raptors terms) under X's 512-character limit.
  const per = Math.max(2, Math.floor((480 - clause.length) / 22));
  const groups: string[][] = [];
  for (let i = 0; i < handles.length; i += per) groups.push(handles.slice(i, i + per));
  for (let gi = 0; gi < groups.length && remaining > 0; gi++) {
    const q = `(${groups[gi].map((h) => `from:${h}`).join(" OR ")}) ${clause} -is:retweet -is:reply`;
    const sinceKey = `feed_since_${gi}`;
    const since = await setting(db, sinceKey, "");
    const params: Record<string, string> = {
      query: q, max_results: String(Math.max(10, Math.min(100, remaining))),
      "tweet.fields": "created_at,public_metrics,entities,attachments,note_tweet,lang,referenced_tweets,author_id",
      expansions: "attachments.media_keys",
      "media.fields": "type,url,preview_image_url,width,height,alt_text",
    };
    // After a long gap (cap hit, outage) skip the backlog rather than paying for stale posts.
    const sinceFresh = since && (await db.from("feed_posts").select("created_at").eq("id", since).maybeSingle()).data?.created_at > new Date(Date.now() - 12 * 3600000).toISOString();
    if (since && sinceFresh) params.since_id = since;
    else params.start_time = new Date(Date.now() - 12 * 3600000).toISOString();

    const body = await xGet("/2/tweets/search/recent", params);
    const posts = (body.data as any[]) ?? [];
    remaining -= posts.length;
    await log(db, "feed_posts", posts.length, posts.length * READ);
    const media = new Map(((body.includes?.media as any[]) ?? []).map((m) => [m.media_key, m]));
    const rows = posts.map((p) => {
      const urls = ((p.entities?.urls as any[]) ?? []).filter((u) => !u.media_key && !/^pic\./.test(u.display_url ?? "") && !String(u.expanded_url ?? "").match(/\/status\/\d+/));
      const m = ((p.attachments?.media_keys as string[]) ?? []).map((k) => media.get(k)).filter(Boolean)
        .map((x: any) => ({ type: x.type, url: x.url ?? x.preview_image_url, w: x.width, h: x.height, alt: x.alt_text ?? null }));
      const raw = p.note_tweet?.text ?? p.text;
      const quotedId = ((p.referenced_tweets as any[]) ?? []).find((r) => r.type === "quoted")?.id ?? null;
      const text = cleanText(raw, (p.entities?.urls as any[]) ?? [], quotedId);
      const linkText = ((p.entities?.urls as any[]) ?? []).map((u) => `${u.expanded_url ?? ""} ${u.title ?? ""}`).join(" ");
      return {
        id: p.id, author_id: p.author_id, handle: byId.get(p.author_id) ?? null, text, created_at: p.created_at, lang: p.lang,
        metrics: p.public_metrics ?? {}, media: m,
        urls: urls.map((u) => ({ url: u.expanded_url, display: u.display_url, title: u.title ?? null, image: u.images?.[0]?.url ?? null })),
        quoted_id: quotedId,
        raptors: isRaps(`${raw} ${linkText}`), metrics_at: new Date().toISOString(),
      };
    });
    const keep = rows.filter((r) => r.raptors); // Raptors, Raptors, Raptors
    if (keep.length) {
      const { error } = await db.from("feed_posts").upsert(keep, { onConflict: "id" });
      if (error) throw new Error(`feed upsert: ${error.message}`);
    }
    if (rows.length) {
      const newest = body.meta?.newest_id ?? rows[0].id;
      await setSetting(db, sinceKey, newest);
    }
    out.push(`feed group ${gi + 1}: ${keep.length} Raptors posts (${rows.length} read)`);
  }
  return out;
}

/* ---------- metrics refresh + scoring ---------- */
// One refresh per post, ~2h after it went up, inside the same UTC day: X doesn't re-bill a
// post read twice in one UTC day, so this should cost nothing. Logged at $0 so it's visible.
export async function refreshAndScore(db: any, mode: FeedMode = "offday") {
  const out: string[] = [];
  const now = Date.now();
  // Live: check a post ~20 min in so in-game reactions can be reposted while they matter.
  const age = POLICY[mode].ageMin;
  const { data: due } = await db.from("feed_posts").select("id, created_at, fetched_at, metrics_at")
    .gte("fetched_at", utcMidnight()).lte("created_at", new Date(now - (age + 5) * 60000).toISOString()).gte("created_at", new Date(now - 8 * 3600000).toISOString());
  const ids = ((due as any[]) ?? []).filter((p) => Date.parse(p.metrics_at) - Date.parse(p.created_at) < age * 60000).map((p) => p.id).slice(0, 100);
  if (ids.length) {
    const body = await xGet("/2/tweets", { ids: ids.join(","), "tweet.fields": "public_metrics" });
    const ts = new Date().toISOString();
    for (const p of (body.data as any[]) ?? []) await db.from("feed_posts").update({ metrics: p.public_metrics, metrics_at: ts }).eq("id", p.id);
    // Deleted posts come back as errors: drop them from the feed.
    const gone = ((body.errors as any[]) ?? []).map((e) => e.resource_id ?? e.value).filter(Boolean);
    // Hide rather than delete, so the record of who we reposted (and when) is kept.
    if (gone.length) await db.from("feed_posts").update({ hidden: true }).in("id", gone);
    await log(db, "feed_refresh", ids.length, 0);
    out.push(`refreshed ${ids.length}, removed ${gone.length}`);
  }

  // Score = engagement per hour, against that writer's own normal. A small account's
  // breakout beats a big account's routine post.
  const { data: recent } = await db.from("feed_posts").select("id, author_id, created_at, metrics_at, metrics").gte("created_at", new Date(now - 14 * 86400000).toISOString());
  const vel = (p: any) => {
    const m = p.metrics ?? {};
    const hrs = Math.max(0.5, (Date.parse(p.metrics_at) - Date.parse(p.created_at)) / 3600000);
    return (Number(m.like_count ?? 0) + 2 * Number(m.retweet_count ?? 0) + 3 * Number(m.quote_count ?? 0) + 0.5 * Number(m.reply_count ?? 0)) / hrs;
  };
  const byAuthor = new Map<string, number[]>();
  for (const p of (recent as any[]) ?? []) byAuthor.set(p.author_id, [...(byAuthor.get(p.author_id) ?? []), vel(p)]);
  const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
  const meds = new Map([...byAuthor].map(([k, v]) => [k, median(v)]));
  const fresh = ((recent as any[]) ?? []).filter((p) => Date.parse(p.created_at) > now - 72 * 3600000);
  for (const p of fresh) {
    const s = vel(p) / (Number(meds.get(p.author_id) ?? 0) + 1);
    await db.from("feed_posts").update({ score: Math.round(s * 100) / 100 }).eq("id", p.id);
  }
  // Keep two weeks only.
  await db.from("feed_posts").delete().lt("created_at", new Date(now - 14 * 86400000).toISOString());
  return out;
}

/* ---------- reposts ---------- */
export async function maybeRepost(db: any, mode: FeedMode = "offday") {
  const out: string[] = [];
  if ((await setting(db, "posting_mode", "preview")) !== "live") return out;
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false })) % 24;
  if (hour < 8 && mode !== "live" && mode !== "postgame") return out; // overnight only for late games
  const pol = POLICY[mode];
  const perDay = pol.perDay;
  const budget = Number(await setting(db, "x_budget_month", "25")) || 25;
  if ((await monthSpendAll(db)) >= budget * 0.8) return out;

  const dayStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: TZ }) + "T00:00:00-05:00").toISOString();
  const { data: today } = await db.from("feed_posts").select("author_id, reposted_at").gte("reposted_at", dayStart);
  const done = (today as any[]) ?? [];
  if (done.length >= perDay) return out;
  const last = done.map((d) => Date.parse(d.reposted_at)).sort().pop();
  if (last && Date.now() - last < pol.gapMin * 60000) return out; // space them out
  // Let our own posts (Final, Grades) sit on top of the profile for 20 minutes.
  const { data: ours } = await db.from("x_posts").select("posted_at").not("posted_at", "is", null).order("posted_at", { ascending: false }).limit(1).maybeSingle();
  if (ours?.posted_at && Date.now() - Date.parse(ours.posted_at) < 20 * 60000) return out;

  const { data: cands } = await db.from("feed_posts").select("id, author_id, handle, score, created_at, metrics_at, media")
    .eq("raptors", true).eq("hidden", false).is("reposted_at", null)
    .gte("created_at", new Date(Date.now() - (mode === "live" || mode === "postgame" ? 3 : 12) * 3600000).toISOString())
    .order("score", { ascending: false }).limit(20);
  // Never the same writer twice within 24 hours (rolling, not by calendar day).
  const { data: recentReposts } = await db.from("feed_posts").select("author_id").gte("reposted_at", new Date(Date.now() - 24 * 3600000).toISOString());
  const used = new Set(((recentReposts as any[]) ?? []).map((d) => d.author_id));
  // During games, clips and photos get a boost: they're what people want mid-game.
  const live = mode === "live" || mode === "postgame";
  const ranked = ((cands as any[]) ?? []).map((c) => ({ ...c, s: Number(c.score) * (live && c.media?.length ? 1.3 : 1) })).sort((a, b) => b.s - a.s);
  const pick = ranked.find((c) => !used.has(c.author_id) && c.s >= pol.minScore
    && Date.parse(c.metrics_at) - Date.parse(c.created_at) >= pol.ageMin * 60000); // only once we've seen how it's doing
  if (!pick) return out;

  let me = await setting(db, "x_user_id", "");
  if (!me) { const r = await xMe(); me = r.body?.data?.id ?? ""; if (me) await setSetting(db, "x_user_id", me); }
  if (!me) throw new Error("could not resolve @PurpleDinosTO user id");
  await xRepost(me, pick.id);
  await db.from("feed_posts").update({ reposted_at: new Date().toISOString() }).eq("id", pick.id);
  await log(db, "repost", 1, REPOST);
  out.push(`reposted @${pick.handle} ${pick.id} (score ${pick.s.toFixed(2)}, ${mode})`);
  return out;
}

export async function runFeed(db: any) {
  const mode = await feedMode();
  const out: string[] = [`mode: ${mode}`];
  out.push(...(await ingestFeed(db, mode)));
  out.push(...(await refreshAndScore(db, mode)));
  out.push(...(await maybeRepost(db, mode)));
  return out;
}
