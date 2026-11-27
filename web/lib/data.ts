import { db } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

async function rpc(name: string, args?: Row): Promise<Row[]> {
  const { data, error } = await db.rpc(name, args ?? {});
  if (error) {
    console.error("rpc", name, error.message);
    return [];
  }
  return (data as Row[]) ?? [];
}

export async function getLastGame() {
  const { data: games } = await db
    .from("games")
    .select("game_id, game_date, opponent_abbr, is_home, wl, team_pts, opp_pts, season_type")
    .order("game_date", { ascending: false })
    .limit(1);
  const game = games?.[0];
  if (!game) return null;
  const { data: players } = await db
    .from("v_player_games")
    .select("full_name, game_score, pts, reb, ast, ts_pct, usg_pct, fga, minutes")
    .eq("game_id", game.game_id)
    .order("game_score", { ascending: false })
    .limit(3);
  return { game, top: players ?? [] };
}

export const getSeasonPulse = () => rpc("season_pulse");
export const getTrendReport = () => rpc("trend_report");
export const getRecordWatch = (limit = 8) => rpc("record_watch", { p_limit: limit });
export const getOnThisDay = async () => (await rpc("on_this_day"))[0] ?? null;

export async function getCurrentSeason(): Promise<Row | null> {
  const { data } = await db.from("seasons").select("season_id, wins, losses").order("season_id", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function getLineups(size: number, minMinutes: number, limit: number, ascending = false) {
  const season = await getCurrentSeason();
  if (!season) return [];
  const { data } = await db
    .from("lineups")
    .select("group_id, minutes, possessions, off_rtg, def_rtg, net_rtg, raw")
    .eq("season_id", season.season_id)
    .eq("group_size", size)
    .eq("garbage_filtered", false)
    .gte("minutes", minMinutes)
    .order("net_rtg", { ascending })
    .limit(limit);
  return (data ?? []).map((r: Row): Row => ({ ...r, name: String(r.raw?.GROUP_NAME ?? "").split(" - ").join(" · ") }));
}

const LEADER_LABELS: Record<string, string> = { PTS: "Points", AST: "Assists", REB: "Rebounds", STL: "Steals", BLK: "Blocks", FG3M: "Threes", GP: "Games" };

export async function getRecordBook(maxRank = 1) {
  const { data } = await db
    .from("franchise_leaders")
    .select("category, rank, value, players(full_name)")
    .lte("rank", maxRank)
    .order("rank");
  return (data ?? []).map((r: Row) => ({
    category: r.category,
    label: LEADER_LABELS[r.category] ?? r.category,
    rank: r.rank,
    value: Number(r.value),
    name: r.players?.full_name ?? "",
  }));
}

export async function getLegendComps(names: string[], anchor: string) {
  const { count } = await db
    .from("v_player_games")
    .select("game_id", { count: "exact", head: true })
    .eq("full_name", anchor)
    .eq("season_type", "Regular Season");
  const n = count ?? 0;
  if (!n) return { games: 0, rows: [] as Row[] };
  const rows = await rpc("legend_comps", { p_games: n, p_names: [anchor, ...names] });
  rows.sort((a, b) => (a.full_name === anchor ? -1 : b.full_name === anchor ? 1 : Number(b.ppg) - Number(a.ppg)));
  return { games: n, rows };
}

export const fmt = {
  n1: (v: unknown) => (v === null || v === undefined || v === "" ? "—" : Number(v).toFixed(1)),
  signed: (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1);
  },
  int: (v: unknown) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("en-CA")),
  pct: (v: unknown) => (v === null || v === undefined ? "—" : (Number(v) * 100).toFixed(1) + "%"),
};
