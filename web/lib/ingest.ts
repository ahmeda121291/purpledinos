/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { currentSeason, nba, slim } from "./nba";

const SEASON_TYPES: Record<string, string> = { "2": "Regular Season", "4": "Playoffs", "5": "Play-In" };

export function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhphrklhfkvlecaeyaox.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Supabase service key is not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function tokenOk(db: any, req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return false;
  const { data } = await db.from("job_tokens").select("token").eq("token", token).maybeSingle();
  return Boolean(data);
}

async function upsert(db: any, table: string, data: any[], onConflict: string, ignore = false) {
  for (let i = 0; i < data.length; i += 500) {
    const { error } = await db.from(table).upsert(data.slice(i, i + 500), { onConflict, ignoreDuplicates: ignore });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return data.length;
}

// Pulls the current season from stats.nba.com (through the proxy) into Supabase.
export async function runIngest(db: any, opts: { budgetMs?: number } = {}) {
  const season = currentSeason();
  const started = Date.now();
  const budget = opts.budgetMs ?? 45000;
  const counts: Record<string, number> = {};
    // 1. Season record
    const yby = await nba.yearByYear();
    const cur = yby.find((r) => r.YEAR === season);
    if (cur) {
      const pw = cur.PO_WINS ?? 0, pl = cur.PO_LOSSES ?? 0;
      counts.seasons = await upsert(db, "seasons", [{
        season_id: season, start_year: Number(season.slice(0, 4)), wins: cur.WINS, losses: cur.LOSSES,
        playoff_result: pw + pl > 0 ? `${pw}-${pl}` : null, raw: slim(cur), updated_at: new Date().toISOString(),
      }], "season_id");
    }

    // 2. Games this season
    const finder = await nba.gameFinder(season);
    const games = finder
      .filter((r) => SEASON_TYPES[String(r.SEASON_ID)[0]])
      .map((r) => {
        const m: string = r.MATCHUP;
        return {
          game_id: r.GAME_ID, season_id: season, season_type: SEASON_TYPES[String(r.SEASON_ID)[0]],
          game_date: String(r.GAME_DATE).slice(0, 10), is_home: m.includes(" vs. "), opponent_abbr: m.split(" ").pop(),
          team_pts: r.PTS, opp_pts: r.PTS != null && r.PLUS_MINUS != null ? Math.round(r.PTS - r.PLUS_MINUS) : null,
          wl: r.WL, updated_at: new Date().toISOString(),
        };
      });
    counts.games = await upsert(db, "games", games, "game_id");
    const gameIds = new Set(games.map((g) => g.game_id));

    // 3. Player and team game logs
    const month = new Date().getUTCMonth();
    const types = month >= 3 && month <= 6 ? ["Regular Season", "PlayIn", "Playoffs"] : ["Regular Season"];
    const players = new Map<number, string>();
    const pgb: any[] = [];
    const tgb: any[] = [];
    for (const t of types) {
      const [plogs, tlogs] = await Promise.all([nba.playerLogs(season, t), nba.teamLogs(season, t)]);
      for (const r of plogs) {
        if (!gameIds.has(r.GAME_ID)) continue;
        players.set(r.PLAYER_ID, r.PLAYER_NAME);
        pgb.push({
          game_id: r.GAME_ID, player_id: r.PLAYER_ID, team_side: "TOR", minutes: r.MIN, pts: r.PTS, reb: r.REB, ast: r.AST,
          stl: r.STL, blk: r.BLK, tov: r.TOV, pf: r.PF, fgm: r.FGM, fga: r.FGA, fg3m: r.FG3M, fg3a: r.FG3A, ftm: r.FTM, fta: r.FTA,
          oreb: r.OREB, dreb: r.DREB, plus_minus: r.PLUS_MINUS == null ? null : Math.round(r.PLUS_MINUS), traditional: slim(r),
        });
      }
      for (const r of tlogs) if (gameIds.has(r.GAME_ID)) tgb.push({ game_id: r.GAME_ID, team_side: "TOR", traditional: slim(r) });
    }
    counts.players = await upsert(db, "players", [...players].map(([player_id, full_name]) => ({ player_id, full_name })), "player_id", true);
    counts.player_game_box = await upsert(db, "player_game_box", pgb, "game_id,player_id");
    counts.team_game_box = await upsert(db, "team_game_box", tgb, "game_id,team_side");

    // 4. Lineups (season to date)
    const lu: any[] = [];
    for (const size of [5, 3, 2]) {
      for (const r of await nba.lineups(season, size)) {
        lu.push({
          season_id: season, group_size: size, group_id: r.GROUP_ID,
          player_ids: String(r.GROUP_ID).split("-").filter(Boolean).map(Number),
          minutes: r.MIN, possessions: r.POSS ?? null, off_rtg: r.OFF_RATING, def_rtg: r.DEF_RATING, net_rtg: r.NET_RATING,
          raw: slim(r), garbage_filtered: false, updated_at: new Date().toISOString(),
        });
      }
    }
    counts.lineups = await upsert(db, "lineups", lu, "season_id,group_size,group_id,garbage_filtered");

    // 5. Play-by-play for recent games that don't have it yet
    const recent = games.filter((g) => Date.now() - Date.parse(g.game_date) < 4 * 86400000).map((g) => g.game_id);
    let pbpRows = 0;
    for (const gid of recent) {
      if (Date.now() - started > budget) break;
      const { count } = await db.from("play_by_play").select("game_id", { count: "exact", head: true }).eq("game_id", gid);
      if (count) continue;
      const g = games.find((x) => x.game_id === gid)!;
      const seen = new Set<number>();
      const acts = (await nba.playByPlay(gid)).filter((a) => !seen.has(a.actionNumber) && seen.add(a.actionNumber));
      pbpRows += await upsert(db, "play_by_play", acts.map((a) => {
        const h = a.scoreHome, aw = a.scoreAway;
        const margin = h !== "" && h != null && aw !== "" && aw != null ? (Number(h) - Number(aw)) * (g.is_home ? 1 : -1) : null;
        return { game_id: gid, action_number: a.actionNumber, period: a.period, clock: a.clock, score_margin: margin,
          action_type: a.actionType, player_id: a.personId || null, description: a.description,
          raw: { team: a.teamTricode, sub: a.subType, h, a: aw } };
      }), "game_id,action_number", true);
    }
    counts.play_by_play = pbpRows;

  return { season, counts, ms: Date.now() - started };
}
