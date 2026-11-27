/* eslint-disable @typescript-eslint/no-explicit-any */
import { currentSeason, nba, slim } from "./nba";

const seasonId = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// League averages (pace, true shooting, offensive rating) for one season.
export async function syncLeagueSeason(db: any, season: string) {
  const teams = await nba.leagueTeamsAdvanced(season);
  if (!teams.length) return 0;
  const n = (k: string) => avg(teams.map((t) => Number(t[k])).filter((v) => Number.isFinite(v)));
  const ts = n("TS_PCT"), efg = n("EFG_PCT");
  const base = await nba.leagueTeamsTotals(season).catch(() => [] as any[]);
  const KEYS = ["GP", "MIN", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB", "AST", "TOV", "STL", "BLK", "PF", "PTS"];
  const totals = base.length ? Object.fromEntries(KEYS.map((k) => [k, base.reduce((a: number, t: any) => a + Number(t[k] ?? 0), 0)])) : null;
  await db.from("league_seasons").upsert({
    season_id: season, pace: n("PACE"), ortg: n("OFF_RATING"), ts_pct: ts === null ? null : ts * 100, efg_pct: efg === null ? null : efg * 100, teams: teams.length, totals, updated_at: new Date().toISOString(),
  });
  return teams.length;
}

// Each Raptor's age that season.
export async function syncAges(db: any, season: string) {
  const ps = await nba.raptorsPlayers(season);
  const rows = ps.filter((p) => p.PLAYER_ID && p.AGE).map((p) => ({ player_id: Number(p.PLAYER_ID), season_id: season, age: Number(p.AGE) }));
  if (rows.length) await db.from("player_season_meta").upsert(rows);
  return rows.length;
}

// Jersey numbers and positions for the current roster.
export async function syncRoster(db: any) {
  const r = await nba.roster(currentSeason());
  for (const p of r) {
    if (!p.PLAYER_ID) continue;
    await db.from("players").update({ jersey: p.NUM ? String(p.NUM).trim() : null, position: p.POSITION ?? null }).eq("player_id", Number(p.PLAYER_ID));
  }
  return r.length;
}

// Opponent box scores for every Toronto game in a season.
export async function syncOpponents(db: any, season: string) {
  const { data: games } = await db.from("games").select("game_id").eq("season_id", season);
  const ids = new Set(((games as any[]) ?? []).map((g) => g.game_id));
  let n = 0;
  for (const type of ["Regular Season", "Playoffs"]) {
    const logs = await nba.oppLogs(season, type).catch(() => [] as any[]);
    const rows = logs.filter((r: any) => ids.has(r.GAME_ID)).map((r: any) => ({ game_id: r.GAME_ID, team_side: "OPP", traditional: { ...slim(r), TEAM_ABBREVIATION: r.TEAM_ABBREVIATION } }));
    for (let i = 0; i < rows.length; i += 100) await db.from("team_game_box").upsert(rows.slice(i, i + 100), { onConflict: "game_id,team_side" });
    n += rows.length;
  }
  return n;
}

export async function syncHistory(db: any, from: number, to: number, budgetMs = 50000) {
  const t0 = Date.now();
  const done: string[] = [];
  for (let y = from; y <= to; y++) {
    if (Date.now() - t0 > budgetMs) break;
    const s = seasonId(y);
    const [lt, ag, op] = await Promise.all([syncLeagueSeason(db, s).catch(() => -1), syncAges(db, s).catch(() => -1), syncOpponents(db, s).catch(() => -1)]);
    done.push(`${s}:${lt}/${ag}/${op}`);
  }
  return done;
}
