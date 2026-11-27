/* eslint-disable @typescript-eslint/no-explicit-any */
// Live feeds fetched at request time and cached. Every parser is defensive:
// if a source changes shape or is down, the section simply hides.

const TEN_MIN = { next: { revalidate: 600 } } as const;

export type NextGame = {
  tipISO: string;
  opponent: string;
  opponentAbbr: string;
  isHome: boolean;
  venue?: string;
  tv?: string;
};

export async function getNextGame(): Promise<NextGame | null> {
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/tor/schedule", TEN_MIN);
    if (!res.ok) return null;
    const j: any = await res.json();
    const now = Date.now();
    const events: any[] = j?.events ?? [];
    const ev = events
      .filter((e) => e?.date && Date.parse(e.date) > now - 3 * 3600 * 1000 && !e?.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
    if (!ev) return null;
    const comp = ev.competitions?.[0] ?? {};
    const comps: any[] = comp.competitors ?? [];
    const us = comps.find((c) => c?.team?.abbreviation === "TOR");
    const them = comps.find((c) => c?.team?.abbreviation !== "TOR");
    if (!them) return null;
    const isHome = us?.homeAway === "home";
    const tv = (comp.broadcasts ?? [])
      .filter((b: any) => {
        const market = String((typeof b?.market === "string" ? b.market : b?.market?.type) ?? "").toLowerCase();
        return !market || market === "national" || market === (isHome ? "home" : "away");
      })
      .map((b: any) => b?.media?.shortName ?? b?.names?.[0])
      .filter(Boolean)
      .slice(0, 2)
      .join(" / ");
    return {
      tipISO: ev.date,
      opponent: them.team?.shortDisplayName ?? them.team?.displayName ?? them.team?.abbreviation,
      opponentAbbr: them.team?.abbreviation ?? "",
      isHome: us?.homeAway === "home",
      venue: comp.venue?.fullName,
      tv: tv || undefined,
    };
  } catch {
    return null;
  }
}

export type Injury = { name: string; status: string; detail?: string };

export async function getInjuries(): Promise<Injury[]> {
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries", TEN_MIN);
    if (!res.ok) return [];
    const j: any = await res.json();
    const teams: any[] = j?.injuries ?? [];
    const tor = teams.find((t) => /toronto/i.test(t?.displayName ?? "") || t?.team?.abbreviation === "TOR");
    return (tor?.injuries ?? [])
      .map((i: any) => ({
        name: i?.athlete?.displayName ?? "",
        status: i?.status ?? i?.type?.description ?? "",
        detail: i?.shortComment,
      }))
      .filter((i: Injury) => i.name);
  } catch {
    return [];
  }
}

export type Headline = { title: string; source: string; url: string; published?: string };

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function getHeadlines(limit = 6): Promise<Headline[]> {
  try {
    const res = await fetch(
      "https://news.google.com/rss/search?q=%22Toronto+Raptors%22&hl=en-CA&gl=CA&ceid=CA:en",
      TEN_MIN,
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1);
    return items.slice(0, limit).map((it) => {
      const pick = (tag: string) => decode((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) ?? [])[1] ?? "").trim();
      const source = pick("source");
      let title = pick("title");
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      return { title, source, url: pick("link"), published: pick("pubDate") };
    }).filter((h) => h.title && h.url);
  } catch {
    return [];
  }
}

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
