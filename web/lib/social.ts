/* eslint-disable @typescript-eslint/no-explicit-any */
// Data-driven X content beyond the classic cards: polls, trivia, then-vs-now.
import { db } from "./supabase";
import { METRIC, fmtMetric } from "./metrics";
import { getNextGame, getInjuries } from "./feeds";

export type Poll = { options: string[]; minutes: number };
export type Social = { caption: string; data: any; image?: string | null; poll?: Poll; pollText?: string };

const SITE = "https://purpledinos.ca";
const last = (n: string) => n.split(" ").filter((p) => !/^(Jr\.?|II|III|IV)$/.test(p)).pop() ?? n;
const yr = (season: string) => `'${season.slice(5, 7)}`; // 2009-10 -> '10
const opt = (s: string) => (s.length <= 25 ? s : s.slice(0, 24) + "…");
const weekNo = (d = new Date()) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(2026, 0, 5)) / (7 * 86400000));
function seeded<T>(arr: T[], seed: number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.abs((seed * 9301 + 49297 * (i + 1)) % 233280) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function currentSeason() {
  const { data } = await db.from("v_seasons").select("season_id").order("season_id", { ascending: false }).limit(1).maybeSingle();
  return (data as any)?.season_id as string;
}

// Current Raptors who've played enough to count, best first.
async function currentCore(season: string) {
  const { data } = await db.from("v_player_seasons").select("player_id, full_name, gp, tgp, ppg, mpg").eq("season_id", season).order("ppg", { ascending: false });
  return ((data as any[]) ?? []).filter((r) => r.gp >= Math.ceil(0.6 * r.tgp) && r.mpg >= 20);
}

/* -------- Game day over/under poll (reply to the Game Day post) -------- */
export async function overUnder(): Promise<{ player: string; line: number; text: string; poll: Poll } | null> {
  const [next, season, inj] = await Promise.all([getNextGame(), currentSeason(), getInjuries()]);
  if (!next) return null;
  const out = new Set(inj.filter((i: any) => /out|doubtful/i.test(i.status)).map((i: any) => i.name));
  const core = (await currentCore(season)).filter((r) => !out.has(r.full_name));
  const star = core[0];
  if (!star) return null;
  const line = Math.floor(Number(star.ppg)) + 0.5;
  const minutes = Math.max(5, Math.min(10080, Math.round((Date.parse(next.tipISO) - Date.now()) / 60000)));
  return {
    player: star.full_name, line,
    text: `Over/under: ${star.full_name} ${line} points tonight. He's averaging ${Number(star.ppg).toFixed(1)}. 🦖`,
    poll: { options: [`Over ${line}`, `Under ${line}`], minutes },
  };
}

/* -------- Time Machine Tuesday: card + "who's better" poll -------- */
const LEGENDS: [string, string][] = [
  ["Vince Carter", "2000-01"], ["Chris Bosh", "2009-10"], ["Kawhi Leonard", "2018-19"], ["DeMar DeRozan", "2016-17"],
  ["Kyle Lowry", "2016-17"], ["Pascal Siakam", "2019-20"], ["Damon Stoudamire", "1996-97"], ["Fred VanVleet", "2021-22"],
  ["Tracy McGrady", "1999-00"], ["Jose Calderon", "2008-09"], ["Jonas Valanciunas", "2018-19"], ["OG Anunoby", "2022-23"],
];
export async function timeMachine(): Promise<Social | null> {
  const season = await currentSeason();
  const core = await currentCore(season);
  if (!core.length) return null;
  const w = weekNo();
  const me = core[w % Math.min(3, core.length)];
  const [lg, ls] = LEGENDS[w % LEGENDS.length];
  const qs = new URLSearchParams({ kind: "machine", a: me.full_name, as: season, b: lg, bs: ls, era: "1", same: "1" }).toString();
  return {
    caption: `TIME MACHINE ⏳ ${me.full_name} ${yr(season)} vs ${lg} ${yr(ls)}. Same number of games, adjusted to today's pace and scoring.`,
    data: { a: me.full_name, as: season, b: lg, bs: ls },
    image: `${SITE}/api/viz?${qs}`,
    pollText: "Who's having the better season?",
    poll: { options: [opt(`${last(me.full_name)} ${yr(season)}`), opt(`${last(lg)} ${yr(ls)}`)], minutes: 1440 },
  };
}

/* -------- Saturday trivia poll + Sunday reveal -------- */
type Q = { q: string; kind: "jumps" | "best" | "leaders"; metric: string; era?: boolean; label: string };
const BANK: Q[] = [
  { q: "Biggest one-season jump in points per game in Raptors history?", kind: "jumps", metric: "ppg", label: "PPG jump" },
  { q: "Highest single-season PER in Raptors history?", kind: "best", metric: "per", label: "PER" },
  { q: "Most career steals as a Raptor?", kind: "leaders", metric: "stl", label: "steals" },
  { q: "Best Raptors scoring season, adjusted for era?", kind: "best", metric: "ppg", era: true, label: "PPG (era-adjusted)" },
  { q: "Highest single-season assist % in Raptors history?", kind: "best", metric: "ast_pct", label: "AST%" },
  { q: "Biggest one-season jump in assists per game?", kind: "jumps", metric: "apg", label: "APG jump" },
  { q: "Most career threes as a Raptor?", kind: "leaders", metric: "fg3m", label: "threes" },
  { q: "Best single-season block % by a Raptor?", kind: "best", metric: "blk_pct", label: "BLK%" },
  { q: "Biggest one-season jump in true shooting %?", kind: "jumps", metric: "ts_pct", label: "TS% jump" },
  { q: "Most career rebounds as a Raptor?", kind: "leaders", metric: "reb", label: "rebounds" },
  { q: "Best single-season total rebound % by a Raptor?", kind: "best", metric: "trb_pct", label: "TRB%" },
  { q: "Biggest one-season jump in usage rate?", kind: "jumps", metric: "usg_pct", label: "USG% jump" },
];
async function triviaRows(Q: Q) {
  if (Q.kind === "jumps") {
    const { data } = await db.rpc("season_changes", { p_metric: Q.metric, p_min_gp: 41, p_drops: false, p_limit: 12 });
    return ((data as any[]) ?? []).map((r) => ({ name: r.full_name, detail: `${fmtMetric(Q.metric, r.prev_val)} → ${fmtMetric(Q.metric, r.val)} (${r.prev_season.slice(2)} to ${r.season_id.slice(2)})`, val: r.delta }));
  }
  if (Q.kind === "best") {
    const { data } = await db.rpc("best_seasons", { p_metric: Q.metric, p_era: Boolean(Q.era), p_min_gp: 41, p_limit: 12 });
    const key = Q.era && Q.metric === "ppg" ? "adj_ppg" : Q.metric;
    return ((data as any[]) ?? []).map((r) => ({ name: r.full_name, detail: `${fmtMetric(Q.metric, r[key])} in ${r.season_id}`, val: r[key] }));
  }
  const { data } = await db.from("v_career_totals").select(`full_name, ${Q.metric}`).order(Q.metric, { ascending: false }).limit(12);
  return ((data as any[]) ?? []).map((r) => ({ name: r.full_name, detail: `${Number(r[Q.metric]).toLocaleString("en-CA")} ${Q.label}`, val: r[Q.metric] }));
}
function revealImage(Q: Q) {
  if (Q.kind === "jumps") return `${SITE}/api/viz?kind=jumps&jm=${Q.metric}&jd=up&jmin=41`;
  if (Q.kind === "best") return `${SITE}/api/viz?kind=best&bm=${Q.metric}&era=${Q.era ? 1 : 0}&bmin=41`;
  return `${SITE}/api/viz?kind=bar&src=leaders&cat=${Q.metric}`;
}
export async function trivia(weekOffset = 0): Promise<Social | null> {
  const w = weekNo() - weekOffset;
  const Q = BANK[((w % BANK.length) + BANK.length) % BANK.length];
  const rows = await triviaRows(Q);
  const seen = new Set<string>();
  const uniq = rows.filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)));
  if (uniq.length < 4) return null;
  const answer = uniq[0];
  const options = seeded([answer, ...seeded(uniq.slice(1, 8), w).slice(0, 3)], w + 7).map((r) => opt(r.name));
  return {
    caption: `RAPTORS TRIVIA 🧠 ${Q.q} No googling. Answer drops tomorrow.`,
    data: { q: Q.q, answer: answer.name, detail: answer.detail, options, reveal: revealImage(Q) },
    image: null,
    poll: { options, minutes: 1440 },
  };
}
export async function triviaReveal(): Promise<Social | null> {
  const t = await trivia(0);
  if (!t) return null;
  return {
    caption: `ANSWER 🧠 ${t.data.answer}: ${t.data.detail}. How'd you do?`,
    data: t.data,
    image: t.data.reveal,
  };
}

/* -------- Then vs Now tracker: where this season ranks all-time -------- */
const TRACK: [string, boolean][] = [["per", false], ["ppg", true], ["ast_pct", false], ["ts_pct", true], ["trb_pct", false], ["stl_pct", false], ["blk_pct", false], ["usg_pct", false], ["efg_pct", false], ["stocks36", false], ["ast_to", false], ["gmsc36", false]];
export async function tracker(): Promise<Social | null> {
  const season = await currentSeason();
  const w = weekNo();
  for (let i = 0; i < TRACK.length; i++) {
    const [metric, era] = TRACK[(w + i) % TRACK.length];
    const { data } = await db.rpc("best_seasons", { p_metric: metric, p_era: era, p_min_gp: 41, p_limit: 20 });
    const rows = (data as any[]) ?? [];
    const idx = rows.findIndex((r) => r.season_id === season);
    if (idx < 0 || idx > 14) continue;
    const r = rows[idx];
    const key = era && metric === "ppg" ? "adj_ppg" : era && metric === "ts_pct" ? "adj_ts" : metric;
    const above = rows[idx - 1], below = rows[idx + 1];
    const m = METRIC[metric];
    const ctx = above && below ? ` Sandwiched between ${last(above.full_name)} ${yr(above.season_id)} and ${last(below.full_name)} ${yr(below.season_id)}.` : "";
    return {
      caption: `THEN VS NOW 📈 ${r.full_name}'s ${m.label.toLowerCase()}${era ? " (era-adjusted)" : ""} this season: ${fmtMetric(metric, r[key])}. That's #${idx + 1} in Raptors history.${ctx}`,
      data: { metric, era, player: r.full_name, rank: idx + 1 },
      image: `${SITE}/api/viz?kind=best&bm=${metric}&era=${era ? 1 : 0}&bmin=41&hp=${encodeURIComponent(r.full_name)}&hs=${season}`,
    };
  }
  return null;
}

/* -------- Growth chart: biggest year-over-year leap by a current Raptor -------- */
const GROW = ["ppg", "usg_pct", "ast_pct", "ts_pct", "per", "trb_pct", "par3_pct", "stocks36", "apg", "rpg"];
export async function growth(): Promise<Social | null> {
  const season = await currentSeason();
  const w = weekNo();
  for (let i = 0; i < GROW.length; i++) {
    const metric = GROW[(w + i) % GROW.length];
    const { data } = await db.rpc("season_changes", { p_metric: metric, p_min_gp: 41, p_drops: false, p_limit: 40 });
    const rows = (data as any[]) ?? [];
    const idx = rows.findIndex((r) => r.season_id === season);
    if (idx < 0 || idx > 24) continue;
    const r = rows[idx], m = METRIC[metric];
    // Ladder: the top jumps all-time, with this one slotted in where it ranks.
    const pick = (x: any, i: number) => ({ name: x.full_name, season: x.season_id, delta: Number(x.delta), rank: i + 1, me: x === r });
    const ladder = rows.slice(0, 5).map(pick);
    if (idx >= 5) ladder.push(pick(r, idx));
    return {
      caption: `GROWTH CHART 📈 ${r.full_name}'s ${m.label.toLowerCase()}: ${fmtMetric(metric, r.prev_val)} last season → ${fmtMetric(metric, r.val)} now. That's the #${idx + 1} biggest one-year jump in Raptors history.`,
      data: { metric, label: m.label, player: r.full_name, rank: idx + 1, prev: fmtMetric(metric, r.prev_val), now: fmtMetric(metric, r.val), delta: fmtMetric(metric, r.delta), prevSeason: r.prev_season, season: r.season_id, ladder },
    };
  }
  return null;
}

/* -------- Career highs set in the latest game (added to the Final caption) -------- */
export async function careerHighs(gameId: string) {
  const { data: box } = await db.from("v_player_games").select("player_id, full_name, pts, reb, ast, game_date").eq("game_id", gameId);
  const out: string[] = [];
  for (const b of (box as any[]) ?? []) {
    for (const [k, label, min] of [["pts", "points", 15], ["reb", "rebounds", 10], ["ast", "assists", 8]] as const) {
      if (Number(b[k]) < min) continue;
      const { data: prev } = await db.from("v_player_games").select(k).eq("player_id", b.player_id).lt("game_date", b.game_date).order(k, { ascending: false }).limit(1).maybeSingle();
      const { count } = await db.from("v_player_games").select("game_id", { count: "exact", head: true }).eq("player_id", b.player_id).lt("game_date", b.game_date);
      if ((count ?? 0) >= 20 && prev && Number(b[k]) > Number((prev as any)[k])) out.push(`${last(b.full_name)} ${b[k]} ${label}`);
    }
  }
  return out;
}
