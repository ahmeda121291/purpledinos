"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/supabase";
import { playerHref } from "@/lib/slug";
import Tip from "./Tip";
import Jersey from "./Jersey";
import MetricSelect from "./MetricSelect";
import { METRIC, ERA_ADJ, fmtMetric } from "@/lib/metrics";

type P = { get: (k: string, d: string) => string; set: (patch: Record<string, string | null>) => void };
type PS = { player_id: number; full_name: string; season_id: string; gp: number; tgp: number };

const n1 = (v: any) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(1));
const sg = (v: any) => (v === null || v === undefined ? "—" : (Number(v) > 0 ? "+" : Number(v) < 0 ? "−" : "") + Math.abs(Number(v)).toFixed(1));

// Shared, cached list of every Raptors player-season.
let seasonsCache: Promise<PS[]> | null = null;
export function usePlayerSeasons() {
  const [rows, setRows] = useState<PS[]>([]);
  useEffect(() => {
    seasonsCache ??= (async () => {
      const out: PS[] = [];
      for (let from = 0; from < 4000; from += 1000) {
        const { data } = await db.from("v_player_seasons").select("player_id, full_name, season_id, gp, tgp").range(from, from + 999);
        out.push(...((data as PS[]) ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    })();
    seasonsCache.then(setRows);
  }, []);
  return rows;
}
let jerseyCache: Promise<Record<string, string>> | null = null;
export function useJerseys() {
  const [m, setM] = useState<Record<string, string>>({});
  useEffect(() => {
    jerseyCache ??= Promise.resolve(db.from("players").select("full_name, jersey").not("jersey", "is", null)).then(({ data }) => Object.fromEntries(((data as any[]) ?? []).map((r) => [r.full_name, r.jersey])));
    jerseyCache.then(setM);
  }, []);
  return m;
}

function Sel({ label, value, onChange, options, tip }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; tip?: string }) {
  return (
    <label className="ctl">
      <span className="k muted">{label}{tip ? <Tip term={tip} /> : null}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}
export function EraToggle({ p }: { p: P }) {
  const on = p.get("era", "0") === "1";
  return (
    <div className="ctl">
      <span className="k muted">Era<Tip term="era" /></span>
      <div className="pills">
        <button type="button" className={!on ? "pill on" : "pill"} aria-pressed={!on} onClick={() => p.set({ era: null })}>As played</button>
        <button type="button" className={on ? "pill on" : "pill"} aria-pressed={on} onClick={() => p.set({ era: "1" })}>Era-adjusted</button>
      </div>
    </div>
  );
}
function usePlayerOpts(rows: PS[]) {
  return useMemo(() => {
    const byName = new Map<string, PS[]>();
    for (const r of rows) byName.set(r.full_name, [...(byName.get(r.full_name) ?? []), r]);
    for (const v of byName.values()) v.sort((a, b) => b.season_id.localeCompare(a.season_id));
    const names = [...byName.keys()].sort();
    return { byName, names: names.map((n) => [n, n] as [string, string]) };
  }, [rows]);
}

/* ---------------- Time Machine ---------------- */
const MACHINE_ROWS: { key: string; adj?: string; label: string; tip?: string; fmt?: "s"; lowerBetter?: boolean }[] = [
  { key: "ppg", adj: "adj_ppg", label: "Points" },
  { key: "rpg", adj: "adj_rpg", label: "Rebounds" },
  { key: "apg", adj: "adj_apg", label: "Assists" },
  { key: "spg", adj: "adj_spg", label: "Steals" },
  { key: "bpg", adj: "adj_bpg", label: "Blocks" },
  { key: "fg3m", adj: "adj_fg3m", label: "Threes made" },
  { key: "ts_pct", adj: "adj_ts", label: "True shooting %", tip: "ts" },
  { key: "rel_ts", label: "TS vs league avg", tip: "relts", fmt: "s" },
  { key: "usg_pct", label: "Usage %", tip: "usg" },
  { key: "gmsc", label: "Game Score", tip: "gmsc" },
  { key: "pts_share", label: "Share of team points" },
  { key: "mpg", label: "Minutes" },
  { key: "tpg", label: "Turnovers", lowerBetter: true },
  { key: "team_net", label: "Team net rating", tip: "net", fmt: "s" },
];

export function machineQs(p: P, cur: string) {
  return new URLSearchParams({ kind: "machine", a: p.get("a", "Scottie Barnes"), as: p.get("as", cur), b: p.get("b", "Chris Bosh"), bs: p.get("bs", "2009-10"), era: p.get("era", "0"), same: p.get("same", "1") }).toString();
}

export function TimeMachine({ p, current }: { p: P; current: string }) {
  const rows = usePlayerSeasons();
  const jerseys = useJerseys();
  const { byName, names } = usePlayerOpts(rows);
  const a = p.get("a", "Scottie Barnes"), b = p.get("b", "Chris Bosh");
  const aSeasons = byName.get(a) ?? [], bSeasons = byName.get(b) ?? [];
  const as = p.get("as", aSeasons[0]?.season_id ?? current), bs = p.get("bs", b === "Chris Bosh" ? "2009-10" : bSeasons[0]?.season_id ?? "");
  const era = p.get("era", "0") === "1", same = p.get("same", "1") === "1";
  const ga = aSeasons.find((s) => s.season_id === as)?.gp, gb = bSeasons.find((s) => s.season_id === bs)?.gp;
  const cap = same && ga && gb ? Math.min(ga, gb) : null;
  const [lines, setLines] = useState<any[]>([]);
  useEffect(() => {
    const A = aSeasons.find((s) => s.season_id === as), B = bSeasons.find((s) => s.season_id === bs);
    if (!A || !B) return;
    let off = false;
    Promise.all([
      db.rpc("player_season_line", { p_id: A.player_id, p_season: as, p_cap: cap }),
      db.rpc("player_season_line", { p_id: B.player_id, p_season: bs, p_cap: cap }),
    ]).then(([x, y]) => { if (!off) setLines([((x.data as any[]) ?? [])[0], ((y.data as any[]) ?? [])[0]]); });
    return () => { off = true; };
  }, [a, as, b, bs, cap, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const [L, R] = lines;
  let winsL = 0, winsR = 0;
  const shown = MACHINE_ROWS.map((r) => {
    const k = era && r.adj ? r.adj : r.key;
    const lv = L ? Number(L[k]) : NaN, rv = R ? Number(R[k]) : NaN;
    const better = Number.isNaN(lv) || Number.isNaN(rv) || lv === rv ? 0 : (lv > rv) !== Boolean(r.lowerBetter) ? -1 : 1;
    if (better === -1) winsL++; else if (better === 1) winsR++;
    return { ...r, k, lv, rv, better };
  });
  const seasonOpts = (list: PS[]) => list.map((s) => [s.season_id, `${s.season_id}${s.season_id === current ? " (now)" : ""} · ${s.gp} GP`] as [string, string]);
  const verdict = L && R ? (winsL === winsR ? "Dead even." : `${winsL > winsR ? L.full_name.split(" ").pop() : R.full_name.split(" ").pop()} takes ${Math.max(winsL, winsR)} of ${winsL + winsR} categories.`) : "";

  const Side = ({ x, side }: { x: any; side: "L" | "R" }) => (
    <div className={`glass tm-side ${side === "L" ? "tm-l" : "tm-r"}`} style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
      {x && jerseys[x.full_name] && x.season_id === current ? <Jersey name={x.full_name} number={jerseys[x.full_name]} size={64} /> : <span className="se tm-yr">&apos;{String(x?.season_id ?? "").slice(2, 4)}</span>}
      <div style={{ minWidth: 0 }}>
        <Link className="ul" href={playerHref(x?.full_name ?? "")} style={{ color: "var(--ink)", fontWeight: 800, fontSize: 20 }}>{x?.full_name ?? "…"}</Link>
        <div className="mono muted" style={{ fontSize: 13, marginTop: 4 }}>{x ? `${x.season_id} · age ${x.age ? Math.round(Number(x.age)) : "—"} · ${x.gp} GP · team ${x.team_w}–${x.team_l}` : ""}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="controls">
        <Sel label="Player A" value={a} onChange={(v) => p.set({ a: v, as: byName.get(v)?.[0]?.season_id ?? null })} options={names.length ? names : [[a, a]]} />
        <Sel label="Season" value={as} onChange={(v) => p.set({ as: v })} options={seasonOpts(aSeasons)} />
        <Sel label="Player B" value={b} onChange={(v) => p.set({ b: v, bs: byName.get(v)?.[0]?.season_id ?? null })} options={names.length ? names : [[b, b]]} />
        <Sel label="Season" value={bs} onChange={(v) => p.set({ bs: v })} options={seasonOpts(bSeasons)} />
      </div>
      <div className="controls">
        <EraToggle p={p} />
        <div className="ctl">
          <span className="k muted">Games</span>
          <div className="pills">
            <button type="button" className={same ? "pill on" : "pill"} aria-pressed={same} onClick={() => p.set({ same: null })}>Same number of games</button>
            <button type="button" className={!same ? "pill on" : "pill"} aria-pressed={!same} onClick={() => p.set({ same: "0" })}>Full seasons</button>
          </div>
        </div>
      </div>
      <p className="k muted" style={{ fontSize: 11, margin: "0 0 14px" }}>
        {cap ? `First ${cap} games of each season` : "Full seasons"} · {era ? "translated to today's pace and scoring" : "as played"}
      </p>
      <div className="tm-heads"><Side x={L} side="L" /><span className="se tm-vs">vs</span><Side x={R} side="R" /></div>
      <div className="glass" style={{ padding: "6px 20px", marginTop: 14 }}>
        {shown.map((r) => {
          const tot = Math.abs(r.lv) + Math.abs(r.rv) || 1;
          return (
            <div key={r.key} className="tm-row">
              <span className={`tm-v ${r.better === -1 ? "win" : ""}`}>{r.fmt === "s" ? sg(r.lv) : n1(r.lv)}</span>
              <div className="tm-mid">
                <span className="k" style={{ fontSize: 11, color: "var(--soft)" }}>{r.label}{r.tip ? <Tip term={r.tip} /> : null}{era && r.adj ? <span className="gold"> · adj</span> : null}</span>
                <div className="tm-bars">
                  <span className="tm-bar l" style={{ width: `${(Math.abs(r.lv) / tot) * 100}%`, opacity: r.better === -1 ? 1 : 0.45 }} />
                  <span className="tm-bar r" style={{ width: `${(Math.abs(r.rv) / tot) * 100}%`, opacity: r.better === 1 ? 1 : 0.45 }} />
                </div>
              </div>
              <span className={`tm-v ${r.better === 1 ? "win" : ""}`} style={{ textAlign: "right" }}>{r.fmt === "s" ? sg(r.rv) : n1(r.rv)}</span>
            </div>
          );
        })}
      </div>
      {verdict ? <p style={{ fontSize: 20, fontWeight: 800, margin: "18px 0 0" }}>{verdict}</p> : null}
    </div>
  );
}

/* ---------------- Best seasons ---------------- */
export function bestQs(p: P) {
  return new URLSearchParams({ kind: "best", bm: p.get("bm", "ppg"), era: p.get("era", "0"), bmin: p.get("bmin", "41") }).toString();
}

export function BestSeasons({ p, current }: { p: P; current: string }) {
  const m = p.get("bm", "ppg"), era = p.get("era", "0") === "1", min = p.get("bmin", "41");
  const [rows, setRows] = useState<any[]>([]);
  const jerseys = useJerseys();
  useEffect(() => {
    let off = false;
    db.rpc("best_seasons", { p_metric: m, p_era: era, p_min_gp: Number(min), p_limit: 25 }).then(({ data }) => { if (!off) setRows((data as any[]) ?? []); });
    return () => { off = true; };
  }, [m, era, min]);
  const ADJ = ERA_ADJ;
  const key = era && ADJ[m] ? ADJ[m] : m;
  const label = METRIC[m]?.label ?? m;
  const live = rows.findIndex((r) => r.season_id === current);
  return (
    <div>
      <div className="controls">
        <MetricSelect label="Stat" value={m} onChange={(v) => p.set({ bm: v })} only={(k) => k !== "mpg"} />
        <EraToggle p={p} />
        <Sel label="Min games" value={min} onChange={(v) => p.set({ bmin: v })} options={[["20", "20+"], ["41", "41+"], ["58", "58+"], ["70", "70+"]]} />
      </div>
      {live >= 0 ? (
        <div className="glass" style={{ padding: "16px 20px", marginBottom: 16, borderColor: "rgba(217,184,120,.5)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {jerseys[rows[live].full_name] ? <Jersey name={rows[live].full_name} number={jerseys[rows[live].full_name]} size={48} /> : null}
          <p style={{ margin: 0, fontSize: 17 }}><span className="dot live" style={{ background: "#E5484D", marginRight: 8 }} /><b>{rows[live].full_name}</b>&apos;s {current} currently ranks <b className="gold">#{live + 1}</b> in Raptors history for {label.toLowerCase()}{era && ADJ[m] ? " (era-adjusted)" : ""}.</p>
        </div>
      ) : null}
      <p className="k muted" style={{ fontSize: 11, margin: "0 0 12px" }}>Regular season · the current season counts once a player has played 60% of the team&apos;s games</p>
      <div className="glass scroll" style={{ padding: "8px 22px" }}>
        <table className="t">
          <thead><tr><th>#</th><th style={{ textAlign: "left" }}>Player</th><th>Season</th><th>Age</th><th>GP</th><th>{METRIC[m]?.short ?? label}{era && ADJ[m] ? " (adj)" : ""}{METRIC[m]?.tip ? <Tip term={METRIC[m].tip!} /> : null}</th>{era && ADJ[m] ? <th>As played</th> : null}{m !== "ppg" ? <th>PPG</th> : null}<th>RPG</th><th>APG</th><th>TS%<Tip term="ts" /></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player_id + r.season_id} className={r.season_id === current ? "live-row" : undefined}>
                <td>{i + 1}</td>
                <td style={{ textAlign: "left" }}><Link className="ul" href={playerHref(r.full_name)} style={{ color: "var(--ink)", fontWeight: 600 }}>{r.full_name}</Link>{r.season_id === current ? <span className="k" style={{ fontSize: 10, color: "#E5484D", marginLeft: 8 }}>Live</span> : null}</td>
                <td>{r.season_id}</td><td>{r.age ? Math.round(Number(r.age)) : "—"}</td><td>{r.gp}</td>
                <td className="sorted">{fmtMetric(m, r[key])}</td>
                {era && ADJ[m] ? <td>{n1(r[m])}</td> : null}
                {m !== "ppg" ? <td>{n1(r.ppg)}</td> : null}<td>{n1(r.rpg)}</td><td>{n1(r.apg)}</td><td>{n1(r.ts_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Team history ---------------- */
export function teamsQs(p: P, n: number) {
  return new URLSearchParams({ kind: "teams", tn: p.get("tn", String(n)), tc: p.get("tc", "2018-19"), tsort: p.get("tsort", "net") }).toString();
}
export function TeamHistory({ p, current }: { p: P; current: string }) {
  const [curGames, setCurGames] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    db.from("v_team_games").select("game_id", { count: "exact", head: true }).eq("season_id", current).eq("season_type", "Regular Season").then(({ count }) => setCurGames(count ?? 82));
  }, [current]);
  const n = Number(p.get("tn", String(curGames || 82)));
  const comp = p.get("tc", "2018-19"), sort = p.get("tsort", "net");
  useEffect(() => {
    if (!n) return;
    let off = false;
    db.rpc("team_seasons", { p_games: n }).then(({ data }) => { if (!off) setRows((data as any[]) ?? []); });
    return () => { off = true; };
  }, [n]);
  const now = rows.find((r) => r.season_id === current), then = rows.find((r) => r.season_id === comp);
  const sorted = [...rows].sort((a, b) => (sort === "drtg" || sort === "tov_pct" ? Number(a[sort]) - Number(b[sort]) : Number(b[sort]) - Number(a[sort])));
  const rank = sorted.findIndex((r) => r.season_id === current) + 1;
  const CMP: [string, string, string?, boolean?][] = [["w", "Wins"], ["on_pace", "On pace for (wins)"], ["ortg", "Offence", "ortg"], ["drtg", "Defence", "drtg", true], ["net", "Net rating", "net"], ["pace", "Pace"], ["ts_pct", "True shooting %", "ts"], ["par3", "3PA rate", "par3"], ["tov_pct", "Turnover %", "tov", true]];
  const nOpts: [string, string][] = [...new Set([curGames, 10, 20, 30, 41, 60, 82].filter(Boolean))].sort((x, y) => x - y).map((v) => [String(v), v === curGames ? `${v} (where we are now)` : String(v)]);
  return (
    <div>
      <div className="controls">
        <Sel label="Through first N games" value={String(n)} onChange={(v) => p.set({ tn: v })} options={nOpts} />
        <Sel label="Compare with" value={comp} onChange={(v) => p.set({ tc: v })} options={rows.filter((r) => r.season_id !== current).map((r) => [r.season_id, `${r.season_id}${r.playoff_result ? ` · ${r.playoff_result}` : ""}`])} />
        <Sel label="Rank by" value={sort} onChange={(v) => p.set({ tsort: v })} options={[["net", "Net rating"], ["w", "Wins"], ["ortg", "Offence"], ["drtg", "Defence"], ["pace", "Pace"], ["par3", "3PA rate"]]} />
      </div>
      {now && then ? (
        <div className="glass" style={{ padding: "8px 20px", marginBottom: 18 }}>
          <div className="tm-row" style={{ borderTop: 0 }}>
            <span className="tm-v" style={{ fontSize: 18 }}>{current}</span>
            <div className="tm-mid"><span className="k gold" style={{ fontSize: 11 }}>First {n} games</span></div>
            <span className="tm-v" style={{ fontSize: 18, textAlign: "right" }}>{comp}</span>
          </div>
          {CMP.map(([k, label, tip, low]) => {
            const lv = Number(now[k]), rv = Number(then[k]);
            const better = lv === rv ? 0 : (lv > rv) !== Boolean(low) ? -1 : 1;
            return (
              <div key={k} className="tm-row">
                <span className={`tm-v ${better === -1 ? "win" : ""}`}>{k === "net" ? sg(lv) : k === "w" || k === "on_pace" ? `${lv}${k === "w" ? `–${now.l}` : ""}` : n1(lv)}</span>
                <div className="tm-mid"><span className="k" style={{ fontSize: 11, color: "var(--soft)" }}>{label}{tip ? <Tip term={tip} /> : null}</span></div>
                <span className={`tm-v ${better === 1 ? "win" : ""}`} style={{ textAlign: "right" }}>{k === "net" ? sg(rv) : k === "w" || k === "on_pace" ? `${rv}${k === "w" ? `–${then.l}` : ""}` : n1(rv)}</span>
              </div>
            );
          })}
          <p className="soft" style={{ margin: "12px 0 6px", fontSize: 14 }}>{comp} finished {then.final_w}–{then.final_l}{then.playoff_result ? ` · ${then.playoff_result}` : ""}.</p>
        </div>
      ) : null}
      {rank ? <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>This start ranks <span className="gold">#{rank} of {rows.length}</span> Raptors seasons by {sort === "w" ? "wins" : sort === "net" ? "net rating" : sort}.</p> : null}
      <div className="glass scroll" style={{ padding: "8px 22px" }}>
        <table className="t">
          <thead><tr><th>Season</th><th>Record</th><th>Off<Tip term="ortg" /></th><th>Def<Tip term="drtg" /></th><th>Net<Tip term="net" /></th><th>Pace</th><th>TS%</th><th>3PA rate</th><th>Final</th><th>Playoffs</th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.season_id} className={r.season_id === current ? "live-row" : r.season_id === comp ? "cmp-row" : undefined}>
                <td>{r.season_id}</td><td>{r.w}–{r.l}</td><td>{n1(r.ortg)}</td><td>{n1(r.drtg)}</td><td className={sort === "net" ? "sorted" : undefined}>{sg(r.net)}</td><td>{n1(r.pace)}</td><td>{n1(r.ts_pct)}</td><td>{n1(r.par3)}</td>
                <td>{r.final_w != null ? `${r.final_w}–${r.final_l}` : "—"}</td><td style={{ fontFamily: "inherit", fontSize: 13 }}>{r.playoff_result ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Similar seasons ---------------- */
export function similarQs(p: P, cur: string) {
  return new URLSearchParams({ kind: "similar", sp: p.get("sp", "Scottie Barnes"), ss: p.get("ss", cur) }).toString();
}
export function SimilarSeasons({ p, current }: { p: P; current: string }) {
  const rows = usePlayerSeasons();
  const { byName, names } = usePlayerOpts(rows);
  const name = p.get("sp", "Scottie Barnes");
  const list = byName.get(name) ?? [];
  const season = p.get("ss", list[0]?.season_id ?? current);
  const me = list.find((s) => s.season_id === season);
  const [res, setRes] = useState<any[]>([]);
  useEffect(() => {
    if (!me) return;
    let off = false;
    db.rpc("similar_seasons", { p_id: me.player_id, p_season: season, p_limit: 8 }).then(({ data }) => { if (!off) setRes((data as any[]) ?? []); });
    return () => { off = true; };
  }, [me?.player_id, season]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="controls">
        <Sel label="Player" value={name} onChange={(v) => p.set({ sp: v, ss: byName.get(v)?.[0]?.season_id ?? null })} options={names.length ? names : [[name, name]]} />
        <Sel label="Season" value={season} onChange={(v) => p.set({ ss: v })} options={list.map((s) => [s.season_id, `${s.season_id} · ${s.gp} GP`])} />
      </div>
      <p className="soft" style={{ margin: "0 0 16px", maxWidth: "52em" }}>Matched on an era-adjusted per-36 profile: scoring, rebounding, playmaking, defence stats, turnovers, three-point diet, efficiency vs league, and usage.<Tip term="similar" /></p>
      <div className="grid-auto">
        {res.map((r, i) => (
          <div key={r.player_id + r.season_id} className="glass lift" style={{ padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
            <div className="match" style={{ ["--m" as any]: `${r.match}%` }}><span>{r.match}<small>%</small></span></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="k muted" style={{ fontSize: 10 }}>#{i + 1} match</div>
              <Link className="ul" href={playerHref(r.full_name)} style={{ color: "var(--ink)", fontWeight: 800, fontSize: 18 }}>{r.full_name}</Link> <span className="muted">{r.season_id}</span>
              <div className="mono muted" style={{ fontSize: 13, marginTop: 4 }}>{n1(r.ppg)} / {n1(r.rpg)} / {n1(r.apg)} · {n1(r.ts_pct)} TS · {n1(r.usg_pct)} USG</div>
              <button type="button" className="ul" style={{ all: "unset", cursor: "pointer", color: "var(--gold)", fontSize: 13, marginTop: 6, fontWeight: 600 }}
                onClick={() => p.set({ tab: "machine", a: name, as: season, b: r.full_name, bs: r.season_id })}>Put them in the Time Machine →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Career arcs ---------------- */
export function arcQs(p: P) {
  return new URLSearchParams({ kind: "arc", players: p.get("arc", "Scottie Barnes,Vince Carter,DeMar DeRozan,Kyle Lowry"), am: p.get("am", "pts") }).toString();
}
export function CareerArcs({ p }: { p: P }) {
  const rows = usePlayerSeasons();
  const { names } = usePlayerOpts(rows);
  const picked = p.get("arc", "Scottie Barnes,Vince Carter,DeMar DeRozan,Kyle Lowry").split(",").filter(Boolean);
  const qs = arcQs(p);
  const [loading, setLoading] = useState(true);
  useEffect(() => setLoading(true), [qs]);
  return (
    <div>
      <div className="controls">
        {[0, 1, 2, 3].map((i) => (
          <Sel key={i} label={`Player ${i + 1}`} value={picked[i] ?? ""} onChange={(v) => { const n = [...picked]; if (v) n[i] = v; else n.splice(i, 1); p.set({ arc: [...new Set(n)].join(",") }); }}
            options={[["", i < picked.length ? "— remove —" : "— add —"], ...names]} />
        ))}
        <Sel label="Track" value={p.get("am", "pts")} onChange={(v) => p.set({ am: v })} options={[["pts", "Career points"], ["reb", "Career rebounds"], ["ast", "Career assists"], ["gmsc", "Game Score (20-game avg)"]]} />
      </div>
      <p className="k muted" style={{ fontSize: 11, margin: "0 0 12px" }}>Regular season, as a Raptor, by game number</p>
      <div className="glass viz-frame" style={{ padding: 10, position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={qs} src={`/api/viz?${qs}`} alt="Career arc chart" width={1200} height={675} onLoad={() => setLoading(false)} style={{ width: "100%", height: "auto", display: "block", borderRadius: 20, opacity: loading ? 0.35 : 1, transition: "opacity .3s" }} />
        {loading ? <div className="k gold" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>Drawing…</div> : null}
      </div>
    </div>
  );
}

/* ---------------- Game logs ---------------- */
const MONTHS: [string, string][] = [["", "Any month"], ["10", "October"], ["11", "November"], ["12", "December"], ["1", "January"], ["2", "February"], ["3", "March"], ["4", "April"]];
export function GameLogs({ p }: { p: P }) {
  const ps = usePlayerSeasons();
  const { byName, names } = usePlayerOpts(ps);
  const name = p.get("gl", "Scottie Barnes");
  const seasons = byName.get(name) ?? [];
  const f = { season: p.get("gls", ""), opp: p.get("opp", ""), loc: p.get("loc", ""), res: p.get("res", ""), rest: p.get("rest", ""), mon: p.get("mon", ""), type: p.get("glt", "Regular Season") };
  const [games, setGames] = useState<any[]>([]);
  useEffect(() => {
    const id = seasons[0]?.player_id;
    if (!id) return;
    let off = false;
    db.from("v_player_gamelog").select("game_id, game_date, season_id, season_type, opponent_abbr, is_home, wl, team_pts, opp_pts, minutes, pts, reb, ast, stl, blk, tov, fgm, fga, fg3m, fg3a, ftm, fta, plus_minus, game_score, rest_days, game_month")
      .eq("player_id", id).order("game_date", { ascending: false }).limit(1500)
      .then(({ data }) => { if (!off) setGames((data as any[]) ?? []); });
    return () => { off = true; };
  }, [seasons[0]?.player_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const opps = [...new Set(games.map((g) => g.opponent_abbr))].sort();
  const list = games.filter((g) =>
    g.season_type === f.type && (!f.season || g.season_id === f.season) && (!f.opp || g.opponent_abbr === f.opp) && (!f.loc || (f.loc === "home") === g.is_home) &&
    (!f.res || g.wl === f.res) && (!f.mon || String(g.game_month) === f.mon) &&
    (!f.rest || (f.rest === "0" ? g.rest_days === 0 : f.rest === "1" ? g.rest_days === 1 : (g.rest_days ?? 0) >= 2)));
  const sum = (k: string) => list.reduce((a, g) => a + Number(g[k] ?? 0), 0);
  const gp = list.length || 1;
  const ts = (100 * sum("pts")) / (2 * (sum("fga") + 0.44 * sum("fta")) || 1);
  const avg: [string, string][] = [["Games", String(list.length)], ["Record", `${list.filter((g) => g.wl === "W").length}–${list.filter((g) => g.wl === "L").length}`], ["PTS", n1(sum("pts") / gp)], ["REB", n1(sum("reb") / gp)], ["AST", n1(sum("ast") / gp)], ["TS%", n1(ts)], ["3PM", n1(sum("fg3m") / gp)], ["GmSc", n1(sum("game_score") / gp)], ["+/-", sg(sum("plus_minus") / gp)]];
  return (
    <div>
      <div className="controls">
        <Sel label="Player" value={name} onChange={(v) => p.set({ gl: v, gls: null })} options={names.length ? names : [[name, name]]} />
        <Sel label="Season" value={f.season} onChange={(v) => p.set({ gls: v || null })} options={[["", "Whole Raptors career"], ...seasons.map((s) => [s.season_id, s.season_id] as [string, string])]} />
        <Sel label="Games" value={f.type} onChange={(v) => p.set({ glt: v === "Regular Season" ? null : v })} options={[["Regular Season", "Regular season"], ["Playoffs", "Playoffs"]]} />
        <Sel label="Opponent" value={f.opp} onChange={(v) => p.set({ opp: v || null })} options={[["", "Anyone"], ...opps.map((o) => [o, o] as [string, string])]} />
        <Sel label="Where" value={f.loc} onChange={(v) => p.set({ loc: v || null })} options={[["", "Home & road"], ["home", "Home"], ["away", "Road"]]} />
        <Sel label="Result" value={f.res} onChange={(v) => p.set({ res: v || null })} options={[["", "Wins & losses"], ["W", "Wins"], ["L", "Losses"]]} />
        <Sel label="Rest" value={f.rest} onChange={(v) => p.set({ rest: v || null })} options={[["", "Any rest"], ["0", "Back-to-backs"], ["1", "1 day off"], ["2", "2+ days off"]]} />
        <Sel label="Month" value={f.mon} onChange={(v) => p.set({ mon: v || null })} options={MONTHS} />
      </div>
      <div className="stat-strip" style={{ marginBottom: 16 }}>
        {avg.map(([k, v]) => (
          <div key={k} className="glass" style={{ padding: "14px 16px", borderRadius: 18 }}>
            <div className="k muted" style={{ fontSize: 10 }}>{k}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: k === "PTS" ? "var(--gold)" : "var(--ink)" }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="glass scroll" style={{ padding: "8px 22px", maxHeight: 620, overflowY: "auto" }}>
        <table className="t">
          <thead><tr><th>Date</th><th>Opp</th><th>Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG</th><th>3P</th><th>+/-</th><th>GmSc<Tip term="gmsc" /></th><th>Rest</th></tr></thead>
          <tbody>
            {list.slice(0, 200).map((g) => (
              <tr key={g.game_id}>
                <td>{g.game_date}</td><td>{g.is_home ? "vs" : "@"} {g.opponent_abbr}</td><td>{g.wl} {g.team_pts}–{g.opp_pts}</td><td>{Math.round(Number(g.minutes))}</td>
                <td><b>{g.pts}</b></td><td>{g.reb}</td><td>{g.ast}</td><td>{g.fgm}/{g.fga}</td><td>{g.fg3m}/{g.fg3a}</td><td>{sg(g.plus_minus)}</td><td className="gold">{n1(g.game_score)}</td>
                <td>{g.rest_days === 0 ? "B2B" : g.rest_days ?? "—"}</td>
              </tr>
            ))}
            {!list.length ? <tr><td colSpan={12} className="muted" style={{ padding: 24 }}>No games match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Clutch ---------------- */
export function Clutch({ p, current }: { p: P; current: string }) {
  const season = p.get("cs", current);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let off = false;
    db.rpc("clutch_stats", { p_season: season }).then(({ data }) => { if (!off) setRows((data as any[]) ?? []); });
    return () => { off = true; };
  }, [season]);
  const prev = `${Number(current.slice(0, 4)) - 1}-${current.slice(2, 4)}`;
  return (
    <div>
      <div className="controls">
        <Sel label="Season" value={season} onChange={(v) => p.set({ cs: v })} options={[[current, current], [prev, prev]]} />
      </div>
      <p className="soft" style={{ margin: "0 0 16px", maxWidth: "52em" }}>Clutch = the last 5 minutes of the 4th quarter or overtime, score within 5.<Tip term="clutch" /> Built from play-by-play, which goes back to last season.</p>
      <div className="glass scroll" style={{ padding: "8px 22px" }}>
        <table className="t">
          <thead><tr><th>Player</th><th>Clutch games</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>TOV</th><th>TS%<Tip term="ts" /></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_id}>
                <td><Link className="ul" href={playerHref(r.full_name)} style={{ color: "var(--ink)", fontWeight: 600 }}>{r.full_name}</Link></td>
                <td>{r.games}</td><td className="sorted">{r.pts}</td><td>{r.fgm}/{r.fga}</td><td>{r.fg3m}/{r.fg3a}</td><td>{r.ftm}/{r.fta}</td><td>{r.tov}</td><td>{n1(r.ts_pct)}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>No clutch minutes logged yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
