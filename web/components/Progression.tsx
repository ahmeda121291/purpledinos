/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { METRIC, fmtMetric } from "@/lib/metrics";
import Tip from "./Tip";

const SHOW = ["ppg", "per", "ts_pct", "usg_pct", "ast_pct", "trb_pct", "par3_pct", "stocks36", "gmsc36", "tov_pct"];

// Season-over-season sparklines for a player's key numbers.
export default function Progression({ name, seasons }: { name: string; seasons: any[] }) {
  if (seasons.length < 2) return null;
  const W = 260, H = 70;
  return (
    <div className="prog-grid">
      {SHOW.filter((k) => seasons.some((s) => s[k] != null)).map((k) => {
        const m = METRIC[k];
        const pts = seasons.filter((s) => s[k] != null).map((s) => ({ s: s.season_id, v: Number(s[k]) }));
        if (pts.length < 2) return null;
        const vs = pts.map((p) => p.v), lo = Math.min(...vs), hi = Math.max(...vs), pad = (hi - lo) * 0.15 || 1;
        const X = (i: number) => 8 + (i / (pts.length - 1)) * (W - 16), Y = (v: number) => H - 8 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 16);
        const best = pts.reduce((b, p, i) => ((m.lower ? p.v < pts[b].v : p.v > pts[b].v) ? i : b), 0);
        const first = pts[0], last = pts[pts.length - 1];
        const rose = last.v - first.v > 0;
        const good = rose !== Boolean(m.lower);
        return (
          <Link key={k} href={`/stats-lab?tab=progress&pp=${encodeURIComponent(name)}&pm=${k}#explorer`} className="glass lift prog-card" aria-label={`${m.label} by season, chart it`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span className="k muted" style={{ fontSize: 10 }}>{m.short}{m.tip ? <Tip term={m.tip} /> : null}</span>
              <span className="mono" style={{ fontSize: 12, color: good ? "var(--gold)" : "#B9A4F0" }}>{first.s.slice(2)}→{last.s.slice(2)} {rose ? "▲" : "▼"}</span>
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 6px" }}>{fmtMetric(k, last.v)}</div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
              <polyline points={pts.map((p, i) => `${X(i)},${Y(p.v)}`).join(" ")} fill="none" stroke="rgba(154,114,245,.9)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => <circle key={p.s} cx={X(i)} cy={Y(p.v)} r={i === best ? 5 : 3} fill={i === best ? "#D9B878" : "#9A72F5"} />)}
            </svg>
            <div className="mono muted" style={{ fontSize: 11 }}>Peak {fmtMetric(k, pts[best].v)} in {pts[best].s}</div>
          </Link>
        );
      })}
    </div>
  );
}
