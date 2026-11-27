/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from "react";
import { db } from "./supabase";
import { slugify } from "./slug";

export const getAllPlayers = cache(async () => {
  const [{ data: players }, { data: totals }] = await Promise.all([
    db.from("players").select("player_id, full_name, first_season, last_season, is_active"),
    db.from("v_career_totals").select("player_id, gp, pts, reb, ast, last_game"),
  ]);
  const t = new Map(((totals as any[]) ?? []).map((r) => [Number(r.player_id), r]));
  return ((players as any[]) ?? []).map((p) => {
    const c: any = t.get(Number(p.player_id)) ?? {};
    const gp = Number(c.gp ?? 0);
    return { ...p, slug: slugify(p.full_name), gp, ppg: gp ? Number(c.pts) / gp : 0, rpg: gp ? Number(c.reb) / gp : 0, apg: gp ? Number(c.ast) / gp : 0, last_game: c.last_game as string | null };
  });
});

export async function getPlayerBySlug(slug: string) {
  return (await getAllPlayers()).find((p) => p.slug === slug) ?? null;
}

export async function getPlayerProfile(id: number) {
  const [career, seasons, ranks, best, recent, grades] = await Promise.all([
    db.rpc("player_career", { p_id: id }),
    db.rpc("player_seasons", { p_id: id }),
    db.rpc("player_ranks", { p_id: id }),
    db.from("v_player_games").select("game_id, game_date, opponent_abbr, is_home, wl, team_pts, opp_pts, minutes, pts, reb, ast, stl, blk, fgm, fga, fg3m, game_score, season_type").eq("player_id", id).order("game_score", { ascending: false }).limit(5),
    db.from("v_player_games").select("game_id, game_date, opponent_abbr, is_home, wl, minutes, pts, reb, ast, stl, blk, fgm, fga, plus_minus, game_score, ts_pct").eq("player_id", id).gt("minutes", 0).order("game_date", { ascending: false }).limit(10),
    db.rpc("player_fan_grades", { p_id: id, p_limit: 10 }),
  ]);
  const gmap = new Map(((grades.data as any[]) ?? []).map((g) => [g.game_id, g]));
  return {
    career: ((career.data as any[]) ?? [])[0] ?? null,
    seasons: (seasons.data as any[]) ?? [],
    ranks: (ranks.data as any[]) ?? [],
    best: (best.data as any[]) ?? [],
    recent: ((recent.data as any[]) ?? []).map((r) => ({ ...r, lab: gmap.get(r.game_id)?.lab, fan: gmap.get(r.game_id)?.fan })),
  };
}
