export const TEAM_NAMES: Record<string, string> = {
  ATL: "Hawks", BOS: "Celtics", BKN: "Nets", NJN: "Nets", CHA: "Hornets", CHH: "Hornets", CHI: "Bulls", CLE: "Cavaliers",
  DAL: "Mavericks", DEN: "Nuggets", DET: "Pistons", GSW: "Warriors", HOU: "Rockets", IND: "Pacers", LAC: "Clippers",
  LAL: "Lakers", MEM: "Grizzlies", VAN: "Grizzlies", MIA: "Heat", MIL: "Bucks", MIN: "Timberwolves", NOP: "Pelicans",
  NOH: "Hornets", NOK: "Hornets", NYK: "Knicks", OKC: "Thunder", SEA: "SuperSonics", ORL: "Magic", PHI: "76ers",
  PHX: "Suns", POR: "Trail Blazers", SAC: "Kings", SAS: "Spurs", UTA: "Jazz", WAS: "Wizards",
};

export const teamName = (abbr?: string | null) => (abbr ? TEAM_NAMES[abbr] ?? abbr : "");
