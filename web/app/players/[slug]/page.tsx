/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer, X_URL } from "@/components/Chrome";
import { GradeBadge } from "@/components/GradeBoard";
import { fmt } from "@/lib/data";
import { getAllPlayers, getPlayerBySlug, getPlayerProfile } from "@/lib/players";
import { teamName } from "@/lib/teams";

export const revalidate = 3600;
export const dynamicParams = true;
export async function generateStaticParams() {
  return (await getAllPlayers()).sort((a, b) => b.gp - a.gp).slice(0, 40).map((p) => ({ slug: p.slug }));
}

const CAT_LABEL: Record<string, string> = { points: "Points", rebounds: "Rebounds", assists: "Assists", steals: "Steals", blocks: "Blocks", threes: "Threes", games: "Games" };
const years = (p: any) => {
  const a = String(p.first_season ?? "").slice(0, 4), b = p.last_season ? String(Number(String(p.last_season).slice(0, 4)) + 1) : "";
  return p.is_active ? `${a}–now` : a && b ? `${a}–${b}` : a;
};
const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPlayerBySlug(slug);
  if (!p) return {};
  const title = `${p.full_name} Raptors stats, records & game log`;
  const description = `${p.full_name} as a Toronto Raptor (${years(p)}): ${p.gp} games, ${p.ppg.toFixed(1)} PPG, ${p.rpg.toFixed(1)} RPG, ${p.apg.toFixed(1)} APG. Franchise ranks, best games, season-by-season splits and fan grades.`;
  return { title: `${title} · Purple Dinos`, description, alternates: { canonical: `/players/${slug}` }, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPlayerBySlug(slug);
  if (!p) notFound();
  const { career, seasons, ranks, best, recent } = await getPlayerProfile(Number(p.player_id));
  const reg = seasons.filter((s: any) => s.season_type === "Regular Season");
  const po = seasons.filter((s: any) => s.season_type === "Playoffs");
  const topRanks = ranks.filter((r: any) => Number(r.rank) <= 25);
  const compare = `/stats-lab?tab=compare&players=${encodeURIComponent([p.full_name, "Vince Carter", "Kyle Lowry", "DeMar DeRozan"].filter((n, i, a) => a.indexOf(n) === i).slice(0, 4).join(","))}#explorer`;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(`${p.full_name} as a Raptor: ${p.ppg.toFixed(1)}/${p.rpg.toFixed(1)}/${p.apg.toFixed(1)} over ${p.gp} games. Full résumé via @PurpleDinosTO 🦖`)}&url=${encodeURIComponent(`https://purpledinos.ca/players/${slug}`)}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: { "@type": "Person", name: p.full_name, affiliation: { "@type": "SportsTeam", name: "Toronto Raptors" } } };

  const stats: [string, string][] = career ? [
    ["Games", fmt.int(career.gp)], ["PPG", fmt.n1(career.ppg)], ["RPG", fmt.n1(career.rpg)], ["APG", fmt.n1(career.apg)],
    ["TS%", fmt.n1(career.ts_pct)], ["USG%", fmt.n1(career.usg_pct)], ["Avg GmSc", fmt.n1(career.gmsc)], ["Best GmSc", fmt.n1(career.best_gmsc)],
  ] : [];

  return (
    <div style={{ overflow: "hidden" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Header active="players" />
      <main>
        <section className="wrap" style={{ paddingTop: 56, position: "relative" }}>
          <div aria-hidden="true" className="drift" style={{ position: "absolute", right: -120, top: -80, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,63,212,.38), transparent 65%)", pointerEvents: "none" }} />
          <nav aria-label="Breadcrumb" className="k muted" style={{ fontSize: 11, marginBottom: 18 }}><Link className="ul" href="/players">Players</Link> <span className="gold">/</span> {p.full_name}</nav>
          <div className="k gold rise" style={{ marginBottom: 12 }}>{p.is_active ? "Current Raptor" : "Raptors alum"} · {years(p)}</div>
          <h1 className="rise" style={{ margin: 0, fontWeight: 800, fontSize: "clamp(46px,8vw,112px)", lineHeight: 0.9, letterSpacing: "-.05em" }}>
            {p.full_name.split(" ").slice(0, -1).join(" ")} <span className="se" style={{ fontSize: "1.04em" }}>{p.full_name.split(" ").slice(-1)}</span>
          </h1>
          <div className="stat-strip" style={{ marginTop: 36 }}>
            {stats.map(([k, v]) => (
              <div key={k} className="glass lift" style={{ padding: "18px 20px", borderRadius: 20 }}>
                <div className="k muted" style={{ fontSize: 10 }}>{k}</div>
                <div className="mono" style={{ fontSize: 30, fontWeight: 700, marginTop: 4, color: k === "PPG" ? "var(--gold)" : "var(--ink)" }}>{v}</div>
              </div>
            ))}
          </div>
          <p className="k muted" style={{ fontSize: 11, marginTop: 12 }}>Regular season, as a Raptor</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <Link className="btn btn-g" href={compare}>Compare him with the greats</Link>
            <a className="btn btn-o" href={share}>Share on X</a>
          </div>
        </section>

        {career?.season_lab && Number(career.season_games) > 0 ? (
          <section className="wrap sec">
            <div className="glass" style={{ padding: "28px 30px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <GradeBadge g={career.season_lab} kind="lab" size={84} />
              <div style={{ flex: "1 1 300px" }}>
                <div className="k" style={{ color: "#B9A4F0", marginBottom: 6 }}>Lab report card · this season</div>
                <p style={{ margin: 0, fontSize: 18 }}>Averaging a <b>{career.season_lab}</b> from the Lab across <b>{career.season_games}</b> games. Grades come from Game Score, nudged by plus-minus.</p>
              </div>
              <Link className="btn btn-o" href="/grades">Grade the last game →</Link>
            </div>
          </section>
        ) : null}

        {topRanks.length ? (
          <section className="wrap sec">
            <div className="sechead"><h2 className="h2">Franchise <span className="se" style={{ fontSize: "1.1em" }}>ranks</span></h2><span className="k muted">Among {ranks[0]?.of_total} Raptors since 1995</span></div>
            <div className="stat-strip">
              {topRanks.map((r: any) => (
                <div key={r.category} className="glass lift" style={{ padding: "20px 22px", borderRadius: 20 }}>
                  <div className="se" style={{ fontSize: 52, lineHeight: 1 }}>#{r.rank}</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{CAT_LABEL[r.category]}</div>
                  <div className="mono muted" style={{ fontSize: 13 }}>{fmt.int(r.value)}</div>
                </div>
              ))}
            </div>
            <Link className="ul" href="/stats-lab?tab=leaders#explorer" style={{ display: "inline-flex", marginTop: 18, fontWeight: 600, minHeight: 44, alignItems: "center" }}>Full all-time leaderboards →</Link>
          </section>
        ) : null}

        {recent.length && p.is_active ? (
          <section className="wrap sec">
            <div className="sechead"><h2 className="h2">Last <span className="se" style={{ fontSize: "1.1em" }}>10 games</span></h2><span className="k muted">With Lab and fan grades</span></div>
            <div className="glass scroll" style={{ padding: "8px 22px" }}>
              <table className="t">
                <thead><tr><th>Game</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG</th><th>TS%</th><th>+/-</th><th>GmSc</th><th>Lab</th><th>Fans</th></tr></thead>
                <tbody>
                  {recent.map((g: any) => (
                    <tr key={g.game_id}>
                      <td><Link className="ul" href={`/grades/${g.game_id}`} style={{ color: "var(--ink)" }}>{day(g.game_date)} {g.is_home ? "vs" : "@"} {g.opponent_abbr}</Link> <span className="muted mono" style={{ fontSize: 12 }}>{g.wl}</span></td>
                      <td>{Math.round(Number(g.minutes))}</td><td><b>{g.pts}</b></td><td>{g.reb}</td><td>{g.ast}</td><td>{g.fgm}/{g.fga}</td><td>{fmt.pct(g.ts_pct)}</td><td>{fmt.signed(g.plus_minus)}</td><td className="gold">{fmt.n1(g.game_score)}</td>
                      <td style={{ color: "#B9A4F0", fontWeight: 700 }}>{g.lab ?? "—"}</td><td className="gold" style={{ fontWeight: 700 }}>{g.fan ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {best.length ? (
          <section className="wrap sec">
            <div className="sechead"><h2 className="h2">Best <span className="se" style={{ fontSize: "1.1em" }}>nights</span></h2><span className="k muted">Top 5 by Game Score</span></div>
            <div className="grid-auto">
              {best.map((g: any, i: number) => (
                <div key={g.game_id} className="glass lift" style={{ padding: 24, display: "flex", gap: 18, alignItems: "center" }}>
                  <span className="se" style={{ fontSize: 56, lineHeight: 1, color: i ? "var(--muted)" : "var(--gold)" }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{g.pts} pts · {g.reb} reb · {g.ast} ast</div>
                    <div className="muted" style={{ fontSize: 14 }}>{day(g.game_date)} {g.is_home ? "vs" : "at"} {teamName(g.opponent_abbr)} · {g.wl} {g.team_pts}–{g.opp_pts}{g.season_type === "Playoffs" ? " · Playoffs" : ""}</div>
                  </div>
                  <span className="mono gold" style={{ fontSize: 24, fontWeight: 700 }}>{fmt.n1(g.game_score)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {[["Season by season", reg], ["Playoffs", po]].map(([title, rows]: any) => rows.length ? (
          <section key={title} className="wrap sec">
            <div className="sechead"><h2 className="h2">{title}</h2><span className="k muted">Per game</span></div>
            <div className="glass scroll" style={{ padding: "8px 22px" }}>
              <table className="t">
                <thead><tr><th>Season</th><th>GP</th><th>MPG</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG%</th><th>3P%</th><th>TS%</th><th>USG%</th><th>GmSc</th><th>+/-</th></tr></thead>
                <tbody>
                  {rows.map((s: any) => (
                    <tr key={s.season_id + s.season_type}>
                      <td><Link className="ul" href={`/stats-lab?tab=players&season=${s.season_id}${s.season_type === "Playoffs" ? "&type=Playoffs" : ""}#explorer`} style={{ color: "var(--ink)" }}>{s.season_id}</Link></td>
                      <td>{s.gp}</td><td>{fmt.n1(s.mpg)}</td><td><b>{fmt.n1(s.ppg)}</b></td><td>{fmt.n1(s.rpg)}</td><td>{fmt.n1(s.apg)}</td><td>{fmt.n1(s.spg)}</td><td>{fmt.n1(s.bpg)}</td>
                      <td>{fmt.n1(s.fg_pct)}</td><td>{fmt.n1(s.fg3_pct)}</td><td>{fmt.n1(s.ts_pct)}</td><td>{fmt.n1(s.usg_pct)}</td><td className="gold">{fmt.n1(s.gmsc)}</td><td>{fmt.signed(s.pm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null)}

        <section className="wrap sec">
          <div className="glass" style={{ padding: "28px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Every Raptor since 1995 has a page like this.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-o" href="/players">Browse all players</Link>
              <a className="btn btn-o" href={X_URL}>Follow @PurpleDinosTO</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
