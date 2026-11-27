/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer } from "@/components/Chrome";
import PlayerIndex from "@/components/PlayerIndex";
import Jersey from "@/components/Jersey";
import { getAllPlayers } from "@/lib/players";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Every Toronto Raptor since 1995 · Players · Purple Dinos",
  description: "Stats, franchise ranks, best games and season-by-season numbers for every Toronto Raptor since 1995.",
  alternates: { canonical: "/players" },
};

const years = (p: any) => {
  const a = String(p.first_season ?? "").slice(0, 4), b = p.last_season ? String(Number(String(p.last_season).slice(0, 4)) + 1) : "";
  return p.is_active ? `${a}–now` : a && b && a !== b ? `${a}–${b}` : a;
};

export default async function Players() {
  const all = (await getAllPlayers()).filter((p) => p.gp > 0).map((p) => ({ ...p, years: years(p) }));
  const roster = all.filter((p) => p.is_active && p.jersey).sort((a, b) => b.ppg - a.ppg);
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="players" />
      <main className="wrap" style={{ paddingTop: 64 }}>
        <div className="k gold rise" style={{ marginBottom: 12 }}>{all.length} Raptors since 1995</div>
        <h1 className="rise" style={{ margin: 0, fontWeight: 800, fontSize: "clamp(46px,7vw,100px)", lineHeight: 0.92, letterSpacing: "-.05em" }}>Every guy who <span className="se" style={{ fontSize: "1.04em" }}>wore it</span></h1>
        <section className="sec" style={{ paddingTop: 56 }}>
          <div className="sechead"><h2 className="h2">The <span className="se" style={{ fontSize: "1.1em" }}>current</span> squad</h2></div>
          <div className="roster">
            {roster.map((p) => (
              <Link key={p.player_id} href={`/players/${p.slug}`} className="glass lift jersey-card" style={{ padding: "16px 18px", borderRadius: 20, textDecoration: "none", color: "var(--ink)" }}>
                <Jersey name={p.full_name} number={p.jersey} size={58} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{p.full_name}</div>
                  <div className="mono muted" style={{ fontSize: 13, marginTop: 4 }}><b className="gold">{p.ppg.toFixed(1)}</b> / {p.rpg.toFixed(1)} / {p.apg.toFixed(1)} · {p.gp} GP{p.pos ? ` · ${p.pos}` : ""}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="sec">
          <div className="sechead"><h2 className="h2">All-time <span className="se" style={{ fontSize: "1.1em" }}>roll call</span></h2><span className="k muted">Regular season as a Raptor</span></div>
          <PlayerIndex players={all} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
