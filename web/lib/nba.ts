/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetch as ufetch, ProxyAgent } from "undici";

// stats.nba.com drops requests from cloud servers, so every call goes out
// through the residential proxy in NBA_PROXY_URL.
export const TOR = "1610612761";
const BASE = "https://stats.nba.com/stats/";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

let agent: ProxyAgent | undefined;
function dispatcher() {
  const url = process.env.NBA_PROXY_URL;
  if (!url) throw new Error("NBA_PROXY_URL is not set");
  agent ??= new ProxyAgent(url);
  return agent;
}

async function getJSON(endpoint: string, params: Record<string, string>, tries = 3): Promise<any> {
  const url = BASE + endpoint + "?" + new URLSearchParams(params).toString();
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await ufetch(url, { headers: HEADERS, dispatcher: dispatcher(), signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export function rows(j: any, idx = 0): Record<string, any>[] {
  const rs = (j?.resultSets ?? [j?.resultSet]).filter(Boolean)[idx];
  if (!rs) return [];
  return rs.rowSet.map((r: any[]) => Object.fromEntries(rs.headers.map((h: string, i: number) => [h, r[i]])));
}

export function currentSeason(d = new Date()): string {
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 8 ? y : y - 1; // seasons start in October; flip in September
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const logParams = (season: string, seasonType: string): Record<string, string> => ({
  DateFrom: "", DateTo: "", GameSegment: "", LastNGames: "", LeagueID: "00", Location: "", MeasureType: "Base", Month: "",
  OppTeamID: "", Outcome: "", PORound: "", PerMode: "Totals", Period: "", SeasonSegment: "", SeasonType: seasonType,
  ShotClockRange: "", TeamID: TOR, VsConference: "", VsDivision: "", Season: season,
});

const dashParams = (season: string, extra: Record<string, string>): Record<string, string> => ({
  College: "", Conference: "", Country: "", DateFrom: "", DateTo: "", Division: "", DraftPick: "", DraftYear: "", GameScope: "",
  GameSegment: "", Height: "", ISTRound: "", LastNGames: "0", LeagueID: "00", Location: "", MeasureType: "Base", Month: "0",
  OpponentTeamID: "0", Outcome: "", PORound: "0", PaceAdjust: "N", PerMode: "PerGame", Period: "0", PlayerExperience: "",
  PlayerPosition: "", PlusMinus: "N", Rank: "N", Season: season, SeasonSegment: "", SeasonType: "Regular Season",
  ShotClockRange: "", StarterBench: "", TeamID: "0", TwoWay: "0", VsConference: "", VsDivision: "", Weight: "", ...extra,
});

export const nba = {
  leagueTeamsAdvanced: (season: string) => getJSON("leaguedashteamstats", dashParams(season, { MeasureType: "Advanced" })).then((j) => rows(j)),
  raptorsPlayers: (season: string) => getJSON("leaguedashplayerstats", dashParams(season, { TeamID: TOR })).then((j) => rows(j)),
  roster: (season: string) => getJSON("commonteamroster", { LeagueID: "00", Season: season, TeamID: TOR }).then((j) => rows(j)),
  yearByYear: () => getJSON("teamyearbyyearstats", { LeagueID: "00", PerMode: "Totals", SeasonType: "Regular Season", TeamID: TOR }).then((j) => rows(j)),
  gameFinder: (season: string) => getJSON("leaguegamefinder", { PlayerOrTeam: "T", TeamID: TOR, LeagueID: "00", Season: season }).then((j) => rows(j)),
  playerLogs: (season: string, type: string) => getJSON("playergamelogs", { ...logParams(season, type), PlayerID: "" }).then((j) => rows(j)),
  teamLogs: (season: string, type: string) => getJSON("teamgamelogs", logParams(season, type)).then((j) => rows(j)),
  lineups: (season: string, size: number) =>
    getJSON("leaguedashlineups", {
      Conference: "", DateFrom: "", DateTo: "", Division: "", GameSegment: "", GameID: "", GroupQuantity: String(size), LastNGames: "0",
      LeagueID: "00", Location: "", MeasureType: "Advanced", Month: "0", OpponentTeamID: "0", Outcome: "", PORound: "0", PaceAdjust: "N",
      PerMode: "Totals", Period: "0", PlusMinus: "N", Rank: "N", Season: season, SeasonSegment: "", SeasonType: "Regular Season",
      ShotClockRange: "", TeamID: TOR, VsConference: "", VsDivision: "",
    }).then((j) => rows(j)),
  playByPlay: (gameId: string) =>
    getJSON("playbyplayv3", { GameID: gameId, StartPeriod: "0", EndPeriod: "0" }).then((j) => (j?.game?.actions ?? []) as any[]),
};

export function slim(d: Record<string, any>) {
  const drop = new Set(["SEASON_YEAR", "TEAM_ID", "TEAM_ABBREVIATION", "TEAM_NAME", "PLAYER_NAME", "NICKNAME", "GAME_DATE", "MATCHUP", "WL", "AVAILABLE_FLAG", "WNBA_FANTASY_PTS"]);
  return Object.fromEntries(Object.entries(d).filter(([k]) => !k.endsWith("_RANK") && !drop.has(k)));
}
