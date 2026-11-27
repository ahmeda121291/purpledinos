/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./supabase";

export const METRICS: Record<string, { label: string; short: string; game?: string; pct?: boolean; signed?: boolean }> = {
  ppg: { label: "Points per game", short: "PTS", game: "pts" },
  rpg: { label: "Rebounds per game", short: "REB", game: "reb" },
  apg: { label: "Assists per game", short: "AST", game: "ast" },
  spg: { label: "Steals per game", short: "STL", game: "stl" },
  bpg: { label: "Blocks per game", short: "BLK", game: "blk" },
  mpg: { label: "Minutes per game", short: "MIN", game: "minutes" },
  ts_pct: { label: "True shooting %", short: "TS%", game: "ts_pct", pct: true },
  usg_pct: { label: "Usage %", short: "USG%", game: "usg_pct", pct: true },
  fg3_pct: { label: "3-point %", short: "3P%", pct: true },
  gmsc: { label: "Game Score", short: "GmSc", game: "game_score" },
  pm: { label: "Plus-minus", short: "+/-", game: "plus_minus", signed: true },
};
export const SPLITS: Record<string, string> = { all: "", last5: "Last 5", last10: "Last 10", home: "Home", away: "Road", wins: "In wins", losses: "In losses" };
const LEADER_CATS: Record<string, string> = { pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals", blk: "Blocks", fg3m: "Threes", gp: "Games" };

const lastName = (n: string) => { const p = n.split(" "); return p.length > 1 && /^(Jr\.?|II|III|IV)$/.test(p[p.length - 1]) ? p[p.length - 2] : p[p.length - 1]; };

async function currentSeason() {
  const { data } = await db.from("v_seasons").select("season_id").order("season_id", { ascending: false }).limit(1).maybeSingle();
  return (data as any)?.season_id ?? "2026-27";
}

async function playerRows(q: URLSearchParams) {
  const season = q.get("season") || (await currentSeason());
  const type = q.get("type") || "Regular Season";
  const split = q.get("split") || "all";
  const mingp = Number(q.get("mingp") || 3);
  const mode = q.get("mode") || "pg";
  const { data } = await db.rpc("player_stats", { p_season: season, p_type: type, p_split: split, p_min_gp: mingp || 1 });
  const rows: any[] = ((data as any[]) ?? []).map((r) => {
    const per36 = (v: any) => (r.mpg > 0 ? (Number(v) * 36) / Number(r.mpg) : null);
    const base = { full_name: r.full_name, gp: r.gp, mpg: mode === "tot" ? r.minutes : r.mpg, fg_pct: r.fg_pct, fg3_pct: r.fg3_pct, ts_pct: r.ts_pct, usg_pct: r.usg_pct, pm: r.pm, gmsc: r.gmsc };
    if (mode === "tot") return { ...base, ppg: r.pts, rpg: r.reb, apg: r.ast, spg: r.stl, bpg: r.blk };
    if (mode === "p36") return { ...base, ppg: per36(r.ppg), rpg: per36(r.rpg), apg: per36(r.apg), spg: per36(r.spg), bpg: per36(r.bpg) };
    return { ...base, ppg: r.ppg, rpg: r.rpg, apg: r.apg, spg: r.spg, bpg: r.bpg };
  });
  const ctx = [season, type === "Playoffs" ? "Playoffs" : "", SPLITS[split] ?? "", mode === "p36" ? "Per 36" : mode === "tot" ? "Totals" : ""].filter(Boolean).join(" · ");
  return { rows, ctx, mode };
}

export async function getViz(q: URLSearchParams): Promise<any> {
  const kind = q.get("kind") || "bar";

  if (kind === "bar") {
    if (q.get("src") === "leaders") {
      const cat = LEADER_CATS[q.get("cat") || "pts"] ? q.get("cat") || "pts" : "pts";
      const { data } = await db.from("v_career_totals").select("full_name, gp, " + cat).order(cat, { ascending: false }).limit(10);
      const rows = ((data as any[]) ?? []).map((r) => ({ name: r.full_name, value: Number(r[cat]) }));
      return { kind, title: `All-time Raptors leaders: ${LEADER_CATS[cat]}`, ctx: "Regular season, as a Raptor, since 1995-96", rows, fmt: "int" };
    }
    const metric = METRICS[q.get("metric") || ""] ? q.get("metric")! : "ppg";
    const { rows, ctx, mode } = await playerRows(q);
    const top = rows.filter((r) => r[metric] !== null && r[metric] !== undefined).sort((a, b) => Number(b[metric]) - Number(a[metric])).slice(0, Number(q.get("n") || 10));
    return { kind, title: `${METRICS[metric].label.replace(" per game", mode === "tot" ? "" : mode === "p36" ? " per 36" : " per game")}`, ctx, rows: top.map((r) => ({ name: r.full_name, value: Number(r[metric]) })), fmt: mode === "tot" && !METRICS[metric].pct ? "int" : METRICS[metric].signed ? "signed" : "1" };
  }

  if (kind === "quadrant") {
    const x = METRICS[q.get("x") || ""] ? q.get("x")! : "usg_pct";
    const y = METRICS[q.get("y") || ""] ? q.get("y")! : "ts_pct";
    const { rows, ctx } = await playerRows(q);
    const pts = rows.filter((r) => r[x] != null && r[y] != null).map((r) => ({ name: lastName(r.full_name), x: Number(r[x]), y: Number(r[y]) }));
    const med = (a: number[]) => { const s = [...a].sort((m, n) => m - n); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const special = x === "usg_pct" && y === "ts_pct";
    return {
      kind, title: `${METRICS[x].short} vs ${METRICS[y].short}`, ctx, pts, x, y, xLabel: METRICS[x].label, yLabel: METRICS[y].label,
      mx: med(pts.map((p) => p.x)), my: med(pts.map((p) => p.y)),
      corners: special ? { tr: "Stars", tl: "Efficient role guys", br: "Volume, no efficiency", bl: "Struggling" } : { tr: `High ${METRICS[x].short} · high ${METRICS[y].short}`, tl: `${METRICS[y].short} only`, br: `${METRICS[x].short} only`, bl: "Neither" },
    };
  }

  if (kind === "line") {
    const player = q.get("player") || "Scottie Barnes";
    const metric = METRICS[q.get("metric") || ""] ? q.get("metric")! : "ppg";
    const scope = q.get("scope") === "seasons" ? "seasons" : "games";
    const { data: p } = await db.from("players").select("player_id, full_name").eq("full_name", player).maybeSingle();
    if (!p) return { kind, title: player, ctx: "Player not found", points: [] };
    if (scope === "seasons") {
      const { data } = await db.rpc("player_seasons", { p_id: (p as any).player_id });
      const pts = ((data as any[]) ?? []).filter((s) => s.season_type === "Regular Season").reverse().map((s) => ({ label: s.season_id.slice(2), value: Number(s[metric]) })).filter((s) => !Number.isNaN(s.value));
      return { kind, title: `${player}: ${METRICS[metric].label}`, ctx: "Season by season, regular season", points: pts, fmt: METRICS[metric].signed ? "signed" : "1" };
    }
    const season = q.get("season") || (await currentSeason());
    const col = METRICS[metric].game ?? "pts";
    const { data } = await db.from("v_player_games").select(`game_date, opponent_abbr, ${col}`).eq("player_id", (p as any).player_id).eq("season_id", season).eq("season_type", "Regular Season").gt("minutes", 0).order("game_date", { ascending: true });
    const raw = ((data as any[]) ?? []).map((g) => ({ label: `${g.game_date.slice(5).replace("-", "/")}`, value: Number(g[col]) * (METRICS[metric].pct ? 100 : 1) }));
    const roll = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 4), i + 1); return w.reduce((a, b) => a + b.value, 0) / w.length; });
    return { kind, title: `${player}: ${METRICS[metric].short} game by game`, ctx: `${season} · dots = each game, line = 5-game average`, points: raw.map((r, i) => ({ ...r, avg: roll[i] })), fmt: METRICS[metric].signed ? "signed" : "1" };
  }

  if (kind === "compare") {
    const names = (q.get("players") || "Scottie Barnes,Vince Carter,Chris Bosh,Kyle Lowry").split(",").filter(Boolean).slice(0, 4);
    const n = Number(q.get("n") || 82);
    const { data } = await db.rpc("legend_comps", { p_games: n, p_names: names });
    const rows = names.map((nm) => ((data as any[]) ?? []).find((r) => r.full_name === nm)).filter(Boolean);
    return { kind, title: `First ${n >= 9999 ? "all" : n} games as a Raptor`, ctx: "Same number of games for everyone", rows };
  }

  if (kind === "machine") {
    const cur = await currentSeason();
    const a = q.get("a") || "Scottie Barnes", as = q.get("as") || cur, b = q.get("b") || "Chris Bosh", bs = q.get("bs") || "2009-10";
    const era = q.get("era") === "1", same = q.get("same") !== "0";
    const { data: ps } = await db.from("v_player_seasons").select("player_id, full_name, season_id, gp").in("full_name", [a, b]);
    const A = ((ps as any[]) ?? []).find((r) => r.full_name === a && r.season_id === as), B = ((ps as any[]) ?? []).find((r) => r.full_name === b && r.season_id === bs);
    if (!A || !B) return { kind: "error", title: "Season not found", ctx: `${a} ${as} vs ${b} ${bs}` };
    const cap = same ? Math.min(A.gp, B.gp) : null;
    const [x, y] = await Promise.all([db.rpc("player_season_line", { p_id: A.player_id, p_season: as, p_cap: cap }), db.rpc("player_season_line", { p_id: B.player_id, p_season: bs, p_cap: cap })]);
    const L = ((x.data as any[]) ?? [])[0], R = ((y.data as any[]) ?? [])[0];
    const defs: [string, string, string?, boolean?][] = [["ppg", "Points", "adj_ppg"], ["rpg", "Rebounds", "adj_rpg"], ["apg", "Assists", "adj_apg"], ["spg", "Steals", "adj_spg"], ["bpg", "Blocks", "adj_bpg"],
      ["ts_pct", "True shooting %", "adj_ts"], ["rel_ts", "TS vs league"], ["usg_pct", "Usage %"], ["gmsc", "Game Score"], ["pts_share", "Share of team pts"], ["team_net", "Team net rating"]];
    const rows = defs.map(([k, label, adj]) => { const kk = era && adj ? adj : k; return { label, l: Number(L?.[kk]), r: Number(R?.[kk]), signed: k === "rel_ts" || k === "team_net" }; });
    return { kind, title: `${a} ${as.slice(2)} vs ${b} ${bs.slice(2)}`, ctx: `${cap ? `First ${cap} games of each season` : "Full seasons"} · ${era ? "era-adjusted to today's league" : "as played"}`, L, R, rows };
  }

  if (kind === "best") {
    const m = q.get("bm") || "ppg", era = q.get("era") === "1";
    const { data } = await db.rpc("best_seasons", { p_metric: m, p_era: era, p_min_gp: Number(q.get("bmin") || 41), p_limit: 10 });
    const ADJ: Record<string, string> = { ppg: "adj_ppg", rpg: "adj_rpg", apg: "adj_apg", spg: "adj_spg", bpg: "adj_bpg", fg3pg: "adj_fg3pg", ts_pct: "adj_ts" };
    const LBL: Record<string, string> = { ppg: "Points", rpg: "Rebounds", apg: "Assists", spg: "Steals", bpg: "Blocks", fg3pg: "Threes", ts_pct: "True shooting", rel_ts: "TS vs league", usg_pct: "Usage", gmsc: "Game Score", pts_share: "Team pts share", pm: "Plus-minus" };
    const key = era && ADJ[m] ? ADJ[m] : m;
    const rows = ((data as any[]) ?? []).map((r, i) => ({ ...r, rank: i + 1, name: r.full_name, val: r[key] }));
    return { kind: "table", title: `Best Raptors seasons: ${LBL[m] ?? m}`, ctx: era ? "Era-adjusted to today's league · regular season" : "As played · regular season", sort: "val",
      cols: [["rank", "#", "int"], ["name", "Player", "text"], ["season_id", "Season", "raw"], ["gp", "GP", "int"], ["val", LBL[m] ?? m, m === "pm" || m === "rel_ts" ? "signed" : "1"], ["ppg", "PPG", "1"], ["ts_pct", "TS%", "1"]], rows };
  }

  if (kind === "teams") {
    const cur = await currentSeason();
    let n = Number(q.get("tn") || 0);
    if (!n) { const { count } = await db.from("v_team_games").select("game_id", { count: "exact", head: true }).eq("season_id", cur).eq("season_type", "Regular Season"); n = count || 82; }
    const sort = q.get("tsort") || "net";
    const { data } = await db.rpc("team_seasons", { p_games: n });
    const rows = ((data as any[]) ?? []).map((r) => ({ ...r, name: r.season_id === cur ? `${r.season_id} ← now` : r.season_id, rec: `${r.w}–${r.l}` }))
      .sort((a: any, b: any) => (sort === "drtg" ? Number(a[sort]) - Number(b[sort]) : Number(b[sort]) - Number(a[sort])));
    const curIdx = rows.findIndex((r: any) => r.season_id === cur);
    const top = rows.slice(0, 10);
    if (curIdx >= 10) top[9] = rows[curIdx];
    return { kind: "table", title: `Best Raptors starts through ${n} games`, ctx: `Ranked by ${sort === "net" ? "net rating" : sort}${curIdx >= 0 ? ` · this team ranks #${curIdx + 1} of ${rows.length}` : ""}`, sort,
      cols: [["name", "Season", "text"], ["rec", "Record", "raw"], ["ortg", "Off", "1"], ["drtg", "Def", "1"], ["net", "Net", "signed"], ["pace", "Pace", "1"], ["ts_pct", "TS%", "1"]], rows: top, highlight: cur };
  }

  if (kind === "similar") {
    const cur = await currentSeason();
    const name = q.get("sp") || "Scottie Barnes", season = q.get("ss") || cur;
    const { data: me } = await db.from("v_player_seasons").select("player_id").eq("full_name", name).eq("season_id", season).maybeSingle();
    if (!me) return { kind: "error", title: "Season not found", ctx: `${name} ${season}` };
    const { data } = await db.rpc("similar_seasons", { p_id: (me as any).player_id, p_season: season, p_limit: 8 });
    const rows = ((data as any[]) ?? []).map((r) => ({ ...r, name: r.full_name, m: `${r.match}%` }));
    return { kind: "table", title: `Seasons most like ${name} ${season}`, ctx: "Era-adjusted per-36 profile · Raptors seasons since 1995", sort: "m",
      cols: [["name", "Player", "text"], ["season_id", "Season", "raw"], ["m", "Match", "raw"], ["ppg", "PPG", "1"], ["rpg", "RPG", "1"], ["apg", "APG", "1"], ["ts_pct", "TS%", "1"], ["usg_pct", "USG%", "1"]], rows };
  }

  if (kind === "arc") {
    const names = (q.get("players") || "Scottie Barnes,Vince Carter,DeMar DeRozan,Kyle Lowry").split(",").filter(Boolean).slice(0, 4);
    const am = q.get("am") || "pts";
    const { data } = await db.rpc("career_arc", { p_names: names });
    const by = new Map<string, any>(((data as any[]) ?? []).map((r) => [r.full_name, r]));
    const series = names.filter((n) => by.has(n)).map((n) => {
      const r = by.get(n);
      const gs: number[] = (r.gmsc ?? []).map(Number);
      const vals = am === "gmsc" ? gs.map((_, i) => { const w = gs.slice(Math.max(0, i - 19), i + 1); return w.reduce((a, b) => a + b, 0) / w.length; }) : ((r[`cum_${am}`] ?? []) as any[]).map(Number);
      return { name: n, vals };
    });
    const LBL: Record<string, string> = { pts: "Career points as a Raptor", reb: "Career rebounds as a Raptor", ast: "Career assists as a Raptor", gmsc: "Game Score, 20-game average" };
    return { kind, title: LBL[am] ?? LBL.pts, ctx: "Regular season, by game number", series };
  }

  // table: mirrors the explorer's URL params
  const tab = q.get("tab") || "players";
  if (tab === "lineups") {
    const season = q.get("lseason") || (await currentSeason());
    const size = Number(q.get("size") || 5), minmin = Number(q.get("minmin") || 25), terms = (q.get("q") || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const sort = q.get("lsort") || "net_rtg", dir = q.get("ldir") || "desc";
    const { data } = await db.from("lineups").select("minutes, possessions, off_rtg, def_rtg, net_rtg, raw").eq("season_id", season).eq("group_size", size).eq("garbage_filtered", false).gte("minutes", minmin).limit(400);
    let rows = ((data as any[]) ?? []).map((r) => ({ name: String(r.raw?.GROUP_NAME ?? "").split(" - ").map((x) => lastName(x.trim())).join(" · "), full: String(r.raw?.GROUP_NAME ?? "").toLowerCase(), minutes: r.minutes, possessions: r.possessions, off_rtg: r.off_rtg, def_rtg: r.def_rtg, net_rtg: r.net_rtg }));
    if (terms.length) rows = rows.filter((r) => terms.every((t) => r.full.includes(t)));
    rows.sort((a: any, b: any) => (dir === "asc" ? 1 : -1) * (Number(a[sort]) - Number(b[sort])));
    return { kind: "table", title: `Best ${size}-man units`, ctx: `${season} · ${minmin}+ minutes · per 100 possessions${terms.length ? ` · with ${terms.join(", ")}` : ""}`, sort,
      cols: [["name", "Unit", "text"], ["minutes", "Min", "int"], ["off_rtg", "Off", "1"], ["def_rtg", "Def", "1"], ["net_rtg", "Net", "signed"]], rows: rows.slice(0, 10) };
  }
  if (tab === "leaders") {
    const cat = LEADER_CATS[q.get("cat") || "pts"] ? q.get("cat") || "pts" : "pts";
    let qq = db.from("v_career_totals").select("full_name, gp, pts, reb, ast, stl, blk, fg3m, last_game").order(cat, { ascending: false }).limit(10);
    if (q.get("scope") === "active") qq = qq.gte("last_game", new Date(Date.now() - 300 * 86400000).toISOString().slice(0, 10));
    const { data } = await qq;
    const rows = ((data as any[]) ?? []).map((r, i) => ({ rank: i + 1, name: r.full_name, value: r[cat], per: r.gp ? Number(r[cat]) / Number(r.gp) : null, gp: r.gp }));
    return { kind: "table", title: `All-time Raptors leaders: ${LEADER_CATS[cat]}`, ctx: q.get("scope") === "active" ? "Current Raptors · regular season" : "Regular season, as a Raptor, since 1995-96", sort: "value",
      cols: [["rank", "#", "int"], ["name", "Player", "text"], ["value", LEADER_CATS[cat], "int"], ...(cat === "gp" ? [] : [["per", "Per game", "1"]]), ["gp", "GP", "int"]], rows };
  }
  if (tab === "compare") {
    const v = await getViz(new URLSearchParams({ kind: "compare", players: q.get("players") || "", n: q.get("n") || "82" }));
    return { kind: "table", title: v.title, ctx: v.ctx, sort: "ppg", cols: [["full_name", "Player", "text"], ["gp", "Games", "int"], ["ppg", "PPG", "1"], ["rpg", "RPG", "1"], ["apg", "APG", "1"], ["ts_pct", "TS%", "1"]], rows: v.rows.map((r: any) => ({ ...r, name: r.full_name })) };
  }
  const { rows, ctx, mode } = await playerRows(q);
  const sort = q.get("sort") || "ppg", dir = q.get("dir") || "desc";
  rows.sort((a: any, b: any) => (typeof a[sort] === "string" ? (dir === "asc" ? 1 : -1) * String(a[sort]).localeCompare(String(b[sort])) : (dir === "asc" ? 1 : -1) * (Number(a[sort] ?? -1e9) - Number(b[sort] ?? -1e9))));
  const n = mode === "tot" ? "int" : "1";
  const cols: any[] = [["name", "Player", "text"], ["gp", "GP", "int"], ["mpg", mode === "tot" ? "MIN" : "MPG", n], ["ppg", "PTS", n], ["rpg", "REB", n], ["apg", "AST", n], ["ts_pct", "TS%", "1"], ["usg_pct", "USG%", "1"], ["pm", "+/-", "signed"], ["gmsc", "GmSc", "1"]];
  const extra: Record<string, any> = { spg: ["spg", "STL", n], bpg: ["bpg", "BLK", n], fg_pct: ["fg_pct", "FG%", "1"], fg3_pct: ["fg3_pct", "3P%", "1"] };
  if (extra[sort]) cols.splice(6, 0, extra[sort]);
  return { kind: "table", title: "Raptors player stats", ctx, sort, cols, rows: rows.slice(0, 10).map((r: any) => ({ ...r, name: r.full_name })) };
}
