/* eslint-disable @typescript-eslint/no-explicit-any */
import { fmt, getLastGame, getLegendComps, getLineups, getOnThisDay, getRecordWatch, getSeasonPulse, getTrendReport } from "./data";
import { getInjuries, getNextGame } from "./feeds";
import { teamName } from "./teams";

export const CARD_TYPES = ["gameday", "final", "record", "onthisday", "report", "lineup", "legends"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_META: Record<CardType, { name: string; when: string }> = {
  gameday: { name: "Game Day", when: "Game mornings, 10 AM" },
  final: { name: "Final", when: "About 15 min after the buzzer" },
  record: { name: "Record Watch", when: "When someone gets close, and the moment a record falls" },
  onthisday: { name: "On This Day", when: "Daily, 12 PM" },
  report: { name: "The 401 Report", when: "Mondays" },
  lineup: { name: "Lineup Lab", when: "Wednesdays" },
  legends: { name: "Same Age, Same Jersey", when: "Fridays" },
};

const tz = "America/Toronto";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz, weekday: "long", month: "short", day: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-CA", { timeZone: tz, hour: "numeric", minute: "2-digit" }).replace(/\./g, "").toUpperCase();
const longDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
const short = (n: string) => n.replace(/^(\S)\S*\s/, "$1. ");

export type Card = { type: CardType; caption: string; data: any } | null;

export async function getCard(type: CardType): Promise<Card> {
  switch (type) {
    case "gameday": {
      const [next, pulse, inj] = await Promise.all([getNextGame(), getSeasonPulse(), getInjuries()]);
      if (!next) return null;
      const l10 = pulse.find((p: any) => p.span === "last10");
      const out = inj.filter((i) => /out/i.test(i.status)).map((i) => i.name);
      const data = { opponent: next.opponent, isHome: next.isHome, when: `${day(next.tipISO)} · ${time(next.tipISO)} ET`, venue: next.venue, l10, out };
      const caption = `GAME DAY 🦖 Raps ${next.isHome ? "vs" : "at"} ${next.opponent}, ${time(next.tipISO)} ET.${l10 ? ` Last 10: ${fmt.signed(l10.net)} net rating.` : ""}${out.length ? ` Out: ${out.slice(0, 3).join(", ")}.` : ""} Let's get it.`;
      return { type, caption, data };
    }
    case "final": {
      const last = await getLastGame();
      if (!last) return null;
      const g = last.game, s = last.top[0];
      const won = g.wl === "W";
      const caption = `FINAL: Raptors ${g.team_pts}, ${teamName(g.opponent_abbr)} ${g.opp_pts}. ${s ? `${s.full_name}: ${s.pts}/${s.reb}/${s.ast} on ${fmt.pct(s.ts_pct)} TS.` : ""} ${won ? "Dub. 🦖" : "On to the next one."}`;
      return { type, caption, data: { ...g, opponent: teamName(g.opponent_abbr), date: longDate(g.game_date), top: last.top } };
    }
    case "record": {
      const rows = await getRecordWatch(3);
      if (!rows.length) return null;
      const r = rows[0];
      const caption = `RECORD WATCH 👀 ${r.full_name} is ${fmt.int(r.gap)} ${r.category} from passing ${r.next_name} for #${Number(r.rank_now) - 1} on the Raptors' all-time list.`;
      return { type, caption, data: { lead: r, rest: rows.slice(1) } };
    }
    case "onthisday": {
      const o = await getOnThisDay();
      if (!o) return null;
      const verb = o.wl === "W" ? "beat" : "fell to";
      const caption = `On this day in ${String(o.game_date).slice(0, 4)}: the Raps ${verb} the ${teamName(o.opponent_abbr)} ${o.team_pts}–${o.opp_pts}${o.top_name ? `. ${o.top_name} led the way with ${o.top_pts}` : ""}. Here since the purple days. 🦖`;
      return { type, caption, data: { ...o, opponent: teamName(o.opponent_abbr), date: longDate(o.game_date), verb } };
    }
    case "report": {
      const t = await getTrendReport();
      if (!t.length) return null;
      const up = t.filter((r: any) => Number(r.ts_delta) > 0).slice(0, 3);
      const down = [...t].reverse().filter((r: any) => Number(r.ts_delta) < 0).slice(0, 3);
      const caption = `THE 401 REPORT 🚗 Express lane: ${up[0] ? `${up[0].full_name} ${fmt.signed(up[0].ts_delta)} TS% over his last 5` : "—"}. Collectors: ${down[0] ? `${down[0].full_name} ${fmt.signed(down[0].ts_delta)}` : "—"}.`;
      return { type, caption, data: { up, down, max: Math.max(1, ...t.map((r: any) => Math.abs(Number(r.ts_delta)))) } };
    }
    case "lineup": {
      const [best, worst] = await Promise.all([getLineups(3, 60, 3), getLineups(3, 60, 1, true)]);
      if (!best.length) return null;
      const b = best[0];
      const caption = `LINEUP LAB 🧪 ${b.name.replace(/ · /g, "–")}: ${fmt.signed(b.net_rtg)} per 100 in ${Math.round(b.minutes)} minutes together. Play them more.`;
      return { type, caption, data: { best, worst: worst[0] } };
    }
    case "legends": {
      const l = await getLegendComps(["Vince Carter", "Chris Bosh", "DeMar DeRozan", "Kyle Lowry", "Pascal Siakam"], "Scottie Barnes");
      if (!l.rows.length) return null;
      const me = l.rows.find((r: any) => r.full_name === "Scottie Barnes");
      const vc = l.rows.find((r: any) => r.full_name === "Vince Carter");
      const caption = `SAME AGE, SAME JERSEY 🦖 Scottie through ${l.games} games as a Raptor: ${fmt.n1(me?.ppg)}/${fmt.n1(me?.rpg)}/${fmt.n1(me?.apg)}. Vince at the same point: ${fmt.n1(vc?.ppg)}/${fmt.n1(vc?.rpg)}/${fmt.n1(vc?.apg)}. Where does he end up?`;
      return { type, caption, data: { games: l.games, rows: l.rows.map((r: any) => ({ ...r, short: short(r.full_name) })) } };
    }
  }
}

export const shareUrl = (type: CardType) => `https://purpledinos.ca/c/${type}`;
export const intentUrl = (type: CardType, caption: string) =>
  `https://x.com/intent/post?text=${encodeURIComponent(caption + " via @PurpleDinosTO")}&url=${encodeURIComponent(shareUrl(type))}`;
