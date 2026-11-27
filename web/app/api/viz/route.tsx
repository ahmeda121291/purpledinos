/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImageResponse } from "next/og";
import { W, H, GOLD, INK, MUTED, SOFT, LILAC, PURPLE, MONO, fonts, K, Frame } from "@/lib/cardkit";
import { getViz } from "@/lib/viz";

export const runtime = "nodejs";

const f = (v: any, t: string = "1") => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  if (t === "int") return Math.round(n).toLocaleString("en-CA");
  if (t === "2") return n.toFixed(2);
  if (t === "signed") return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(1);
  return n.toFixed(1);
};
const COLORS = [GOLD, "#9A72F5", INK, "#6FCF97"];

function Title({ v }: { v: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
      <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>{v.title}</span>
      <span style={{ fontSize: 20, color: SOFT, marginTop: 4 }}>{v.ctx}</span>
    </div>
  );
}

function Bar({ v }: { v: any }) {
  const max = Math.max(...v.rows.map((r: any) => Math.abs(r.value)), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {v.rows.map((r: any, i: number) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 18, height: 32 }}>
          <span style={{ width: 300, fontSize: 21, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? GOLD : INK, overflow: "hidden", whiteSpace: "nowrap" }}>{r.name}</span>
          <div style={{ display: "flex", flex: 1, height: 20, borderRadius: 10, background: "rgba(243,238,230,.07)" }}>
            <div style={{ display: "flex", width: `${Math.max(3, (Math.abs(r.value) / max) * 100)}%`, height: 20, borderRadius: 10, background: i === 0 ? `linear-gradient(90deg, ${PURPLE}, ${GOLD})` : r.value < 0 ? LILAC : `linear-gradient(90deg, #4A2AA8, #9A72F5)` }} />
          </div>
          <span style={{ width: 110, textAlign: "right", fontFamily: MONO, fontSize: 24, color: i === 0 ? GOLD : INK }}>{f(r.value, v.fmt)}</span>
        </div>
      ))}
    </div>
  );
}

function Quadrant({ v }: { v: any }) {
  const PW = 1088, PH = 380;
  const xs = v.pts.map((p: any) => p.x), ys = v.pts.map((p: any) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const px = (x: number) => 30 + ((x - x0) / Math.max(1e-6, x1 - x0)) * (PW - 160);
  const py = (y: number) => 40 + (1 - (y - y0) / Math.max(1e-6, y1 - y0)) * (PH - 100);
  const corner = (t: string, s: any) => <div style={{ position: "absolute", display: "flex", ...s }}><K size={14} color={MUTED}>{t}</K></div>;
  return (
    <div style={{ display: "flex", position: "relative", width: PW, height: PH, borderRadius: 18, border: "1px solid rgba(243,238,230,.12)", background: "rgba(243,238,230,.02)" }}>
      <div style={{ position: "absolute", left: px(v.mx), top: 0, width: 1.5, height: PH, background: "rgba(217,184,120,.35)", display: "flex" }} />
      <div style={{ position: "absolute", top: py(v.my), left: 0, height: 1.5, width: PW, background: "rgba(217,184,120,.35)", display: "flex" }} />
      {corner(v.corners.tr, { right: 16, top: 12 })}{corner(v.corners.tl, { left: 16, top: 12 })}
      {corner(v.corners.br, { right: 16, bottom: 34 })}{corner(v.corners.bl, { left: 16, bottom: 34 })}
      {v.pts.map((p: any, i: number) => {
        const top = p.x >= v.mx && p.y >= v.my;
        return (
          <div key={p.name + i} style={{ position: "absolute", left: px(p.x) - 7, top: py(p.y) - 7, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: top ? GOLD : "#9A72F5", border: "2px solid #0A090C" }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: top ? GOLD : SOFT }}>{p.name}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 16, bottom: 8, display: "flex" }}><K size={14} color={SOFT}>↑ {v.yLabel}  ·  {v.xLabel} →</K></div>
    </div>
  );
}

function Line({ v }: { v: any }) {
  const PW = 1030, PH = 330, pts = v.points as any[];
  if (!pts.length) return <div style={{ display: "flex", fontSize: 30 }}>No games yet.</div>;
  const vals = pts.flatMap((p) => [p.value, p.avg ?? p.value]);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.12 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const X = (i: number) => (pts.length === 1 ? PW / 2 : (i / (pts.length - 1)) * (PW - 20) + 10);
  const Y = (val: number) => (1 - (val - y0) / (y1 - y0)) * PH;
  const lineKey = pts[0].avg !== undefined ? "avg" : "value";
  const poly = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p[lineKey]).toFixed(1)}`).join(" ");
  const showLabels = lineKey === "value" && pts.length <= 14;
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: PH, width: 50, alignItems: "flex-end" }}>
        {[y1, (y0 + y1) / 2, y0].map((t, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 15, color: MUTED }}>{f(t)}</span>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", position: "relative", width: PW, height: PH }}>
          <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
            <line x1="0" y1={PH / 2} x2={PW} y2={PH / 2} stroke="rgba(243,238,230,.08)" strokeWidth="1" />
            {lineKey === "avg" ? pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.value)} r="5" fill="rgba(154,114,245,.55)" />) : null}
            <polyline points={poly} fill="none" stroke={GOLD} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            {lineKey === "value" ? pts.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.value)} r="7" fill={GOLD} stroke="#0A090C" strokeWidth="2" />) : null}
          </svg>
          {showLabels ? pts.map((p, i) => (
            <span key={i} style={{ position: "absolute", left: X(i) - 30, top: Y(p.value) - 34, width: 60, textAlign: "center", fontFamily: MONO, fontSize: 16, color: INK }}>{f(p.value, v.fmt)}</span>
          )) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: PW, marginTop: 8 }}>
          {(pts.length <= 14 ? pts : [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]]).map((p, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 15, color: MUTED }}>{p.label}</span>)}
        </div>
      </div>
    </div>
  );
}

function Compare({ v }: { v: any }) {
  const groups = [["ppg", "PPG"], ["rpg", "RPG"], ["apg", "APG"], ["ts_pct", "TS%"]];
  const BH = 260;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 26 }}>
        {v.rows.map((r: any, i: number) => (
          <div key={r.full_name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: COLORS[i] }} />
            <span style={{ fontSize: 21, fontWeight: 700 }}>{r.full_name}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {groups.map(([k, label]) => {
          const max = Math.max(...v.rows.map((r: any) => Number(r[k]) || 0), 1);
          const min = k === "ts_pct" ? Math.min(...v.rows.map((r: any) => Number(r[k]) || 0)) - 6 : 0;
          return (
            <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 255 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: BH + 30 }}>
                {v.rows.map((r: any, i: number) => {
                  const h = Math.max(6, ((Number(r[k]) - min) / Math.max(1e-6, max - min)) * BH);
                  return (
                    <div key={r.full_name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: 16, color: COLORS[i] }}>{f(r[k])}</span>
                      <div style={{ display: "flex", width: 44, height: h, borderRadius: "10px 10px 4px 4px", background: COLORS[i] }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", marginTop: 10 }}><K size={18} color={SOFT}>{label}</K></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const cell = (k: string, t: string) => (t === "text" ? { flex: 1 } : k === "rank" ? { width: 60, paddingRight: 16 } : { width: k === "span" ? 190 : t === "raw" ? 120 : 96 });

function Machine({ v }: { v: any }) {
  const Head = ({ x, right }: any) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", width: 330 }}>
      <span style={{ fontSize: 28, fontWeight: 800, color: right ? INK : GOLD }}>{x?.full_name}</span>
      <span style={{ fontFamily: MONO, fontSize: 16, color: MUTED }}>{x?.season_id} · age {x?.age ? Math.round(Number(x.age)) : "—"} · {x?.gp} GP</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}><Head x={v.L} /><K size={16} color={SOFT}>vs</K><Head x={v.R} right /></div>
      {v.rows.map((r: any) => {
        const lw = r.label === "Turnovers" ? r.l < r.r : r.l > r.r, rw = r.label === "Turnovers" ? r.r < r.l : r.r > r.l;
        const tot = Math.abs(r.l) + Math.abs(r.r) || 1;
        const fmtv = (x: number) => (Number.isNaN(x) ? "—" : r.signed ? f(x, "signed") : f(x));
        return (
          <div key={r.label} style={{ display: "flex", alignItems: "center", height: 31, gap: 14 }}>
            <span style={{ width: 90, fontFamily: MONO, fontSize: 21, color: lw ? GOLD : SOFT, fontWeight: lw ? 800 : 400 }}>{fmtv(r.l)}</span>
            <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flex: 1, justifyContent: "flex-end" }}><div style={{ display: "flex", width: `${(Math.abs(r.l) / tot) * 100}%`, height: 10, borderRadius: 5, background: lw ? GOLD : "rgba(217,184,120,.3)" }} /></div>
              <span style={{ width: 210, textAlign: "center", display: "flex", justifyContent: "center", fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: MUTED }}>{r.label.toUpperCase()}</span>
              <div style={{ display: "flex", flex: 1 }}><div style={{ display: "flex", width: `${(Math.abs(r.r) / tot) * 100}%`, height: 10, borderRadius: 5, background: rw ? "#9A72F5" : "rgba(154,114,245,.3)" }} /></div>
            </div>
            <span style={{ width: 90, textAlign: "right", display: "flex", justifyContent: "flex-end", fontFamily: MONO, fontSize: 21, color: rw ? "#B9A4F0" : SOFT, fontWeight: rw ? 800 : 400 }}>{fmtv(r.r)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Arc({ v }: { v: any }) {
  const PW = 1020, PH = 320;
  const all = v.series.flatMap((s: any) => s.vals) as number[];
  if (!all.length) return <div style={{ display: "flex", fontSize: 28 }}>No games found.</div>;
  const maxN = Math.max(...v.series.map((s: any) => s.vals.length)), hi = Math.max(...all), lo = Math.min(0, ...all);
  const X = (i: number) => (i / Math.max(1, maxN - 1)) * PW, Y = (y: number) => PH - ((y - lo) / Math.max(1e-6, hi - lo)) * PH;
  const pts = (vals: number[]) => { const step = Math.max(1, Math.ceil(vals.length / 220)); return vals.filter((_, i) => i % step === 0 || i === vals.length - 1).map((y, j, arr) => `${X(j === arr.length - 1 ? vals.length - 1 : j * step).toFixed(1)},${Y(y).toFixed(1)}`).join(" "); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {v.series.map((s: any, i: number) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: COLORS[i] }} />
            <span style={{ fontSize: 17, fontWeight: 700 }}>{s.name.split(" ").slice(-1)[0]}</span>
            <span style={{ fontFamily: MONO, fontSize: 15, color: MUTED }}>{f(s.vals[s.vals.length - 1], v.title.startsWith("Game") ? "1" : "int")} · {s.vals.length} GP</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: PH, width: 60, alignItems: "flex-end" }}>
          {[hi, (hi + lo) / 2, lo].map((t, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 14, color: MUTED }}>{f(t, v.title.startsWith("Game") ? "1" : "int")}</span>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
            <line x1="0" y1={PH / 2} x2={PW} y2={PH / 2} stroke="rgba(243,238,230,.08)" strokeWidth="1" />
            {v.series.map((s: any, i: number) => <polyline key={s.name} points={pts(s.vals)} fill="none" stroke={COLORS[i]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />)}
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", width: PW, marginTop: 6 }}>
            {[1, Math.round(maxN / 2), maxN].map((g) => <span key={g} style={{ fontFamily: MONO, fontSize: 14, color: MUTED }}>Game {g}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Progress({ v }: { v: any }) {
  const PW = 1000, PH = 300;
  const all = v.series.flatMap((s: any) => s.pts) as any[];
  if (!all.length) return <div style={{ display: "flex", fontSize: 28 }}>No seasons found.</div>;
  const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
  const ys = all.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.15 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const X = (x: number) => (xs.length === 1 ? PW / 2 : ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (PW - 40) + 20);
  const Y = (y: number) => (1 - (y - y0) / (y1 - y0)) * PH;
  const labelOf = (x: number) => all.find((p) => p.x === x)?.label ?? String(x);
  const single = v.series.length === 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!single ? (
        <div style={{ display: "flex", gap: 22 }}>
          {v.series.map((s: any, i: number) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: COLORS[i] }} />
              <span style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: PH, width: 60, alignItems: "flex-end" }}>
          {[y1, (y0 + y1) / 2, y0].map((t, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 14, color: MUTED }}>{f(t, v.fmt)}</span>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", position: "relative", width: PW, height: PH }}>
            <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
              <line x1="0" y1={PH / 2} x2={PW} y2={PH / 2} stroke="rgba(243,238,230,.08)" strokeWidth="1" />
              {v.series.map((s: any, i: number) => <polyline key={s.name} points={s.pts.map((p: any) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ")} fill="none" stroke={COLORS[i]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />)}
              {v.series.map((s: any, i: number) => s.pts.map((p: any, j: number) => <circle key={s.name + j} cx={X(p.x)} cy={Y(p.y)} r="7" fill={COLORS[i]} stroke="#0A090C" strokeWidth="2" />))}
            </svg>
            {v.series.length <= 2 && xs.length <= 14 ? v.series.map((s: any, i: number) => s.pts.map((p: any, j: number) => (
              <span key={s.name + j} style={{ position: "absolute", left: X(p.x) - 30, top: Y(p.y) + (i ? 12 : -32), width: 60, textAlign: "center", display: "flex", justifyContent: "center", fontFamily: MONO, fontSize: 15, color: COLORS[i] }}>{f(p.y, v.fmt)}</span>
            ))) : null}
          </div>
          <div style={{ display: "flex", position: "relative", width: PW, height: 22, marginTop: 6 }}>
            {(xs.length <= 16 ? xs : xs.filter((_, i) => i % Math.ceil(xs.length / 12) === 0)).map((x) => <span key={x} style={{ position: "absolute", left: X(x) - 25, width: 50, display: "flex", justifyContent: "center", fontFamily: MONO, fontSize: 14, color: MUTED }}>{labelOf(x)}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Table({ v }: { v: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", padding: "0 0 8px", borderBottom: "1.5px solid rgba(243,238,230,.18)" }}>
        {v.cols.map(([k, label, t]: any) => (
          <span key={k} style={{ display: "flex", justifyContent: t === "text" ? "flex-start" : "flex-end", ...cell(k, t), fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: k === v.sort ? GOLD : MUTED }}>{label.toUpperCase()}</span>
        ))}
      </div>
      {v.rows.map((r: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", height: 35, borderBottom: "1px solid rgba(243,238,230,.07)", background: ("_hi" in r ? r._hi : v.highlight ? r.season_id === v.highlight : i === 0) ? "rgba(107,63,212,.22)" : "transparent" }}>
          {v.cols.map(([k, , t]: any) => (
            <span key={k} style={{ display: "flex", justifyContent: t === "text" ? "flex-start" : "flex-end", ...cell(k, t),
              ...(t === "text" ? {} : { fontFamily: MONO }), fontSize: t === "text" ? 21 : 20, fontWeight: k === v.sort || (t === "text" && ("_hi" in r ? r._hi : i === 0)) ? 800 : t === "text" ? 600 : 400,
              ...(k === "rank" ? { color: MUTED } : { color: k === v.sort ? GOLD : INK }), overflow: "hidden", whiteSpace: "nowrap" }}>{t === "text" || t === "raw" ? String(r[k] ?? "") : f(r[k], t)}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const v = await getViz(q).catch((e) => ({ kind: "error", title: "Couldn't build that chart", ctx: String(e?.message ?? e).slice(0, 80) }));
  const body = v.kind === "bar" ? <Bar v={v} /> : v.kind === "quadrant" ? <Quadrant v={v} /> : v.kind === "line" ? <Line v={v} /> : v.kind === "compare" ? <Compare v={v} /> : v.kind === "table" ? <Table v={v} /> : v.kind === "machine" ? <Machine v={v} /> : v.kind === "arc" ? <Arc v={v} /> : v.kind === "progress" ? <Progress v={v} /> : null;
  const headers: Record<string, string> = { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=900" };
  if (q.get("dl")) headers["Content-Disposition"] = `attachment; filename="purpledinos-${v.kind}.png"`;
  return new ImageResponse(
    <Frame label="Stats Lab">
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Title v={v} />
        {body}
      </div>
    </Frame>,
    { width: W, height: H, fonts: await fonts(), headers },
  );
}
