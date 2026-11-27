/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { fmt, getCurrentSeason, getLegendComps, getLineups, getRecordBook, getSeasonPulse, getTrendReport } from "@/lib/data";

export const revalidate = 600;
export const metadata: Metadata = { title: "Stats Lab · Purple Dinos", description: "Raptors lineups, efficiency and franchise history, ranked against every season since 1995." };

export default async function StatsLab() {
  const [season, pulse, best5, worst5, rotation, legends, book] = await Promise.all([
    getCurrentSeason(),
    getSeasonPulse(),
    getLineups(5, 25, 6),
    getLineups(5, 25, 3, true),
    getTrendReport(),
    getLegendComps(["Vince Carter", "Chris Bosh", "DeMar DeRozan", "Kyle Lowry", "Pascal Siakam"], "Scottie Barnes"),
    getRecordBook(5),
  ]);
  const sp = pulse.find((p: any) => p.span === "season");
  const l10 = pulse.find((p: any) => p.span === "last10");
  const rot = [...rotation].sort((a: any, b: any) => Number(b.mpg) - Number(a.mpg));
  const cats = ["PTS", "REB", "AST", "STL", "BLK", "FG3M"];
  const byCat = cats.map((c) => ({ c, rows: book.filter((b) => b.category === c) })).filter((x) => x.rows.length);

  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="lab" />

      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid rgba(243,238,230,.1)" }}>
        <div aria-hidden="true" className="drift" style={{ position: "absolute", left: "-10%", top: -300, width: 760, height: 760, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,63,212,.5), rgba(107,63,212,0) 65%)" }} />
        <div className="wrap rise" style={{ position: "relative", paddingTop: 88, paddingBottom: 72 }}>
          <div className="k gold" style={{ marginBottom: 14 }}>The nerd section · {season?.season_id}</div>
          <h1 style={{ margin: 0, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-.05em", fontSize: "clamp(64px, 10vw, 150px)" }}>Stats <span className="se">Lab</span></h1>
          <p className="soft" style={{ margin: "20px 0 0", fontSize: 19, maxWidth: "38em" }}>Raptors numbers the box score won&apos;t tell you: who wins their minutes, who&apos;s trending, and how today&apos;s guys stack up against everyone who&apos;s worn the jersey since 1995.</p>
        </div>
      </section>

      {sp && l10 ? (
        <section className="wrap sec" style={{ paddingTop: 72 }}>
          <div className="sechead"><h2 className="h2">Team <span className="se" style={{ fontSize: "1.1em" }}>pulse</span></h2><span className="k muted">Per 100 possessions · regular season</span></div>
          <div className="glass scroll" style={{ padding: "8px 22px" }}>
            <table className="t">
              <thead><tr><th>Span</th><th>Record</th><th>Off rtg</th><th>Def rtg</th><th>Net</th><th>TS%</th><th>TOV%</th><th>3PA rate</th></tr></thead>
              <tbody>
                {[["Season", sp], ["Last 10", l10]].map(([label, r]: any) => (
                  <tr key={label}>
                    <td>{label}</td><td>{r.wins}–{Number(r.games) - Number(r.wins)}</td><td>{fmt.n1(r.ortg)}</td><td>{fmt.n1(r.drtg)}</td>
                    <td className="gold">{fmt.signed(r.net)}</td><td>{fmt.n1(r.ts_pct)}</td><td>{fmt.n1(r.tov_pct)}</td><td>{fmt.n1(r.three_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="wrap sec">
        <div className="sechead">
          <div><div className="k gold" style={{ marginBottom: 12 }}>Lineup Lab</div><h2 className="h2">Five-man <span className="se" style={{ fontSize: "1.1em" }}>units</span></h2></div>
          <span className="k muted">Min. 25 minutes together</span>
        </div>
        <div className="glass scroll" style={{ padding: "8px 22px" }}>
          <table className="t">
            <thead><tr><th>Unit</th><th>Min</th><th>Poss</th><th>Off rtg</th><th>Def rtg</th><th>Net</th></tr></thead>
            <tbody>
              {best5.map((u: any) => (
                <tr key={u.group_id}><td>{u.name}</td><td>{Math.round(u.minutes)}</td><td>{fmt.int(u.possessions)}</td><td>{fmt.n1(u.off_rtg)}</td><td>{fmt.n1(u.def_rtg)}</td><td className="gold">{fmt.signed(u.net_rtg)}</td></tr>
              ))}
              {worst5.length ? <tr><td colSpan={6} className="k muted" style={{ paddingTop: 22 }}>Bleeding points</td></tr> : null}
              {worst5.map((u: any) => (
                <tr key={"w" + u.group_id}><td>{u.name}</td><td>{Math.round(u.minutes)}</td><td>{fmt.int(u.possessions)}</td><td>{fmt.n1(u.off_rtg)}</td><td>{fmt.n1(u.def_rtg)}</td><td style={{ color: "#B9A4F0" }}>{fmt.signed(u.net_rtg)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rot.length ? (
        <section className="wrap sec">
          <div className="sechead">
            <div><div className="k gold" style={{ marginBottom: 12 }}>The 401 Report</div><h2 className="h2">Load <span className="se" style={{ fontSize: "1.1em" }}>&amp; efficiency</span></h2></div>
            <span className="k muted">Rotation players · 18+ minutes</span>
          </div>
          <div className="glass scroll" style={{ padding: "8px 22px" }}>
            <table className="t">
              <thead><tr><th>Player</th><th>GP</th><th>MPG</th><th>Usage</th><th>Usage L5</th><th>TS%</th><th>TS% L5</th><th>Trend</th></tr></thead>
              <tbody>
                {rot.map((r: any) => (
                  <tr key={r.full_name}>
                    <td>{r.full_name}</td><td>{r.gp}</td><td>{fmt.n1(r.mpg)}</td><td>{fmt.n1(r.usg_season)}</td><td>{fmt.n1(r.usg_last5)}</td>
                    <td>{fmt.n1(r.ts_season)}</td><td>{fmt.n1(r.ts_last5)}</td>
                    <td style={{ color: Number(r.ts_delta) >= 0 ? "var(--gold)" : "#B9A4F0" }}>{fmt.signed(r.ts_delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {legends.rows.length ? (
        <section className="wrap sec">
          <div className="sechead">
            <div><div className="k gold" style={{ marginBottom: 12 }}>Same Age, Same Jersey</div><h2 className="h2">Barnes vs the <span className="se" style={{ fontSize: "1.1em" }}>greats</span></h2></div>
            <span className="k muted">Each player&apos;s first {legends.games} regular-season games as a Raptor</span>
          </div>
          <div className="glass scroll" style={{ padding: "8px 22px", background: "linear-gradient(160deg, rgba(58,30,140,.35), rgba(14,12,18,.6))" }}>
            <table className="t">
              <thead><tr><th>Player</th><th>Games</th><th>PPG</th><th>RPG</th><th>APG</th><th>TS%</th></tr></thead>
              <tbody>
                {legends.rows.map((r: any) => (
                  <tr key={r.full_name} style={r.full_name === "Scottie Barnes" ? { fontWeight: 700 } : undefined}>
                    <td style={r.full_name === "Scottie Barnes" ? { color: "var(--gold)" } : undefined}>{r.full_name}</td>
                    <td>{r.gp}</td><td>{fmt.n1(r.ppg)}</td><td>{fmt.n1(r.rpg)}</td><td>{fmt.n1(r.apg)}</td><td>{fmt.n1(r.ts_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section id="records" className="wrap sec">
        <div className="sechead">
          <div><div className="k gold" style={{ marginBottom: 12 }}>ACC Archives</div><h2 className="h2">Record <span className="se" style={{ fontSize: "1.1em" }}>Book</span></h2></div>
          <span className="k muted">Franchise regular-season leaders</span>
        </div>
        <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))" }}>
          {byCat.map(({ c, rows }) => (
            <article key={c} className="glass lift" style={{ padding: 26 }}>
              <div className="k gold" style={{ marginBottom: 10 }}>{rows[0].label}</div>
              {rows.map((r) => (
                <div key={r.rank} className="row" style={{ display: "grid", gridTemplateColumns: "26px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 6px", borderTop: r.rank > 1 ? "1px solid rgba(243,238,230,.07)" : "none" }}>
                  <span className="se" style={{ fontSize: 22, lineHeight: 1, color: r.rank > 1 ? "var(--muted)" : undefined }}>{r.rank}</span>
                  <span>{r.name}</span><span className="mono">{fmt.int(r.value)}</span>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
