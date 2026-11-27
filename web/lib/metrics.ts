// One catalog of stats for every picker on the site. Keys match columns in
// v_player_seasons (all-time) and player_stats (current season).
export type Metric = { key: string; label: string; short: string; group: string; tip?: string; fmt?: "int" | "signed" | "2"; lower?: boolean; game?: string; pct?: boolean };

export const METRIC_GROUPS = ["Scoring", "Shooting efficiency", "Playmaking", "Rebounding", "Defence", "Impact & milestones"] as const;

export const METRICS: Metric[] = [
  { key: "ppg", label: "Points per game", short: "PTS", group: "Scoring", game: "pts" },
  { key: "pts36", label: "Points per 36", short: "PTS/36", group: "Scoring", tip: "per36" },
  { key: "pts100", label: "Points per 100 poss", short: "PTS/100", group: "Scoring", tip: "per100" },
  { key: "pts_share", label: "Share of team points", short: "PTS share", group: "Scoring" },
  { key: "fg3pg", label: "Threes made per game", short: "3PM", group: "Scoring" },
  { key: "ts_pct", label: "True shooting %", short: "TS%", group: "Shooting efficiency", tip: "ts", game: "ts_pct", pct: true },
  { key: "rel_ts", label: "TS vs league average", short: "rTS", group: "Shooting efficiency", tip: "relts", fmt: "signed" },
  { key: "efg_pct", label: "Effective FG %", short: "eFG%", group: "Shooting efficiency", tip: "efg" },
  { key: "fg2_pct", label: "2-point %", short: "2P%", group: "Shooting efficiency" },
  { key: "fg3_pct", label: "3-point %", short: "3P%", group: "Shooting efficiency" },
  { key: "ft_pct", label: "Free throw %", short: "FT%", group: "Shooting efficiency" },
  { key: "par3_pct", label: "3-point attempt rate", short: "3PAr", group: "Shooting efficiency", tip: "par3" },
  { key: "ftr", label: "Free throw rate", short: "FTr", group: "Shooting efficiency", tip: "ftr" },
  { key: "pps", label: "Points per shot", short: "PPS", group: "Shooting efficiency", tip: "pps", fmt: "2" },
  { key: "apg", label: "Assists per game", short: "AST", group: "Playmaking", game: "ast" },
  { key: "ast100", label: "Assists per 100 poss", short: "AST/100", group: "Playmaking", tip: "per100" },
  { key: "ast_pct", label: "Assist %", short: "AST%", group: "Playmaking", tip: "astpct" },
  { key: "ast_to", label: "Assist-to-turnover", short: "AST/TO", group: "Playmaking", tip: "astto", fmt: "2" },
  { key: "tov_pct", label: "Turnover % (lower is better)", short: "TOV%", group: "Playmaking", tip: "tovpct", lower: true },
  { key: "usg_pct", label: "Usage %", short: "USG%", group: "Playmaking", tip: "usg", game: "usg_pct", pct: true },
  { key: "rpg", label: "Rebounds per game", short: "REB", group: "Rebounding", game: "reb" },
  { key: "reb100", label: "Rebounds per 100 poss", short: "REB/100", group: "Rebounding", tip: "per100" },
  { key: "oreb_pct", label: "Offensive rebound %", short: "OREB%", group: "Rebounding", tip: "orebpct" },
  { key: "reb_share", label: "Share of team rebounds on court", short: "REB share", group: "Rebounding", tip: "rebshare" },
  { key: "spg", label: "Steals per game", short: "STL", group: "Defence", game: "stl" },
  { key: "bpg", label: "Blocks per game", short: "BLK", group: "Defence", game: "blk" },
  { key: "stocks36", label: "Stocks (STL+BLK) per 36", short: "Stocks/36", group: "Defence", tip: "stocks" },
  { key: "gmsc", label: "Game Score", short: "GmSc", group: "Impact & milestones", tip: "gmsc", game: "game_score" },
  { key: "gmsc36", label: "Game Score per 36", short: "GmSc/36", group: "Impact & milestones", tip: "gmsc" },
  { key: "lab_gpa", label: "Lab grade average (GPA)", short: "Lab GPA", group: "Impact & milestones", tip: "labgpa", fmt: "2" },
  { key: "pm", label: "Plus-minus per game", short: "+/-", group: "Impact & milestones", tip: "pm", fmt: "signed", game: "plus_minus" },
  { key: "dd", label: "Double-doubles", short: "DD", group: "Impact & milestones", tip: "dd", fmt: "int" },
  { key: "td", label: "Triple-doubles", short: "TD", group: "Impact & milestones", fmt: "int" },
  { key: "g30", label: "30-point games", short: "30+", group: "Impact & milestones", fmt: "int" },
  { key: "mpg", label: "Minutes per game", short: "MIN", group: "Impact & milestones", game: "minutes" },
];
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, Metric>;
export const ERA_ADJ: Record<string, string> = { ppg: "adj_ppg", rpg: "adj_rpg", apg: "adj_apg", spg: "adj_spg", bpg: "adj_bpg", fg3pg: "adj_fg3pg", ts_pct: "adj_ts" };
export const fmtMetric = (key: string, v: unknown) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  const m = METRIC[key]; const n = Number(v);
  if (m?.fmt === "int") return String(Math.round(n));
  if (m?.fmt === "2") return n.toFixed(2);
  if (m?.fmt === "signed") return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1);
  return n.toFixed(1);
};
