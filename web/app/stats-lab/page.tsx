/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { Suspense } from "react";
import { Header, Footer } from "@/components/Chrome";
import StatsExplorer from "@/components/StatsExplorer";
import { db } from "@/lib/supabase";
import { fmt, getCurrentSeason, getSeasonPulse } from "@/lib/data";

export const revalidate = 600;
export const metadata: Metadata = { title: "Stats Lab · Purple Dinos", description: "Raptors lineups, efficiency and franchise history, ranked against every season since 1995." };

export default async function StatsLab() {
  const [season, pulse, seasonRows] = await Promise.all([
    getCurrentSeason(),
    getSeasonPulse(),
    db.from("v_seasons").select("season_id, has_lineups").order("season_id", { ascending: false }),
  ]);
  const seasons = ((seasonRows.data as any[]) ?? []).map((r) => ({ season_id: r.season_id, has_lineups: Boolean(r.has_lineups) }));
  const sp = pulse.find((p: any) => p.span === "season");
  const l10 = pulse.find((p: any) => p.span === "last10");

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

      <section id="explorer" className="wrap sec">
        <div className="sechead">
          <div><div className="k gold" style={{ marginBottom: 12 }}>Explorer</div><h2 className="h2">Go get <span className="se" style={{ fontSize: "1.1em" }}>what you want</span></h2></div>
          <span className="k muted">Every season since 1995 · every view has its own link</span>
        </div>
        <Suspense fallback={<p className="soft">Loading the explorer…</p>}>
          <StatsExplorer seasons={seasons} />
        </Suspense>
      </section>

      <Footer />
    </div>
  );
}
