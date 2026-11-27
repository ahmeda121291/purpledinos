"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/supabase";

type Season = { season_id: string; has_lineups: boolean };
type Col = { key: string; label: string; fmt?: "1" | "int" | "signed"; title?: string };

const TABS = [
  { id: "players", label: "Players" },
  { id: "lineups", label: "Lineups" },
  { id: "leaders", label: "All-time leaders" },
  { id: "compare", label: "Compare" },
];

const f1 = (v: any) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(1));
const fint = (v: any) => (v === null || v === undefined ? "—" : Math.round(Number(v)).toLocaleString("en-CA"));
const fsigned = (v: any) => (v === null || v === undefined ? "—" : (Number(v) > 0 ? "+" : Number(v) < 0 ? "−" : "") + Math.abs(Number(v)).toFixed(1));
const show = (c: Col, v: any) => (c.fmt === "int" ? fint(v) : c.fmt === "signed" ? fsigned(v) : c.fmt === "1" ? f1(v) : v ?? "—");

function useParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const get = (k: string, d: string) => sp.get(k) ?? d;
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v === null || v === "" ? next.delete(k) : next.set(k, v));
    router.replace(`${path}?${next.toString()}#explorer`, { scroll: false });
  };
  return { get, set };
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="ctl">
      <span className="k muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Pills({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <div className="ctl">
      <span className="k muted">{label}</span>
      <div className="pills" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" className={v === value ? "pill on" : "pill"} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function SortTable({ cols, rows, sort, dir, onSort, highlight }: { cols: Col[]; rows: any[]; sort: string; dir: string; onSort: (k: string) => void; highlight?: (r: any) => boolean }) {
  return (
    <div className="glass scroll" style={{ padding: "8px 22px" }}>
      <table className="t">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} title={c.title} aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" className="th-btn" onClick={() => onSort(c.key)} style={{ color: sort === c.key ? "var(--gold)" : undefined }}>
                  {c.label}{sort === c.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._key ?? i} style={highlight?.(r) ? { color: "var(--gold)", fontWeight: 700 } : undefined}>
              {cols.map((c) => <td key={c.key}>{show(c, r[c.key])}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={cols.length} className="muted" style={{ padding: 24 }}>No results for these filters.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function useSorted(rows: any[], sort: string, dir: string) {
  return useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (typeof x === "string" || typeof y === "string") return dir === "asc" ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
      return dir === "asc" ? Number(x ?? -1e9) - Number(y ?? -1e9) : Number(y ?? -1e9) - Number(x ?? -1e9);
    });
    return out;
  }, [rows, sort, dir]);
}

/* ---------------- Players ---------------- */
function Players({ seasons, p }: { seasons: Season[]; p: ReturnType<typeof useParams> }) {
  const season = p.get("season", seasons[0]?.season_id ?? "");
  const type = p.get("type", "Regular Season");
  const split = p.get("split", "all");
  const mode = p.get("mode", "pg");
  const mingp = p.get("mingp", "3");
  const sort = p.get("sort", "ppg"), dir = p.get("dir", "desc");
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let off = false;
    setLoading(true);
    db.rpc("player_stats", { p_season: season, p_type: type, p_split: split, p_min_gp: Number(mingp) || 1 }).then(({ data }) => {
      if (!off) { setRaw((data as any[]) ?? []); setLoading(false); }
    });
    return () => { off = true; };
  }, [season, type, split, mingp]);

  const rows = useMemo(() => raw.map((r) => {
    const per36 = (v: any) => (r.mpg > 0 ? (Number(v) * 36) / Number(r.mpg) : null);
    const base = { _key: r.player_id, full_name: r.full_name, gp: r.gp, mpg: mode === "tot" ? r.minutes : r.mpg, fg_pct: r.fg_pct, fg3_pct: r.fg3_pct, ft_pct: r.ft_pct, ts_pct: r.ts_pct, usg_pct: r.usg_pct, pm: r.pm, gmsc: r.gmsc };
    if (mode === "tot") return { ...base, ppg: r.pts, rpg: r.reb, apg: r.ast, spg: r.stl, bpg: r.blk, tpg: r.tov };
    if (mode === "p36") return { ...base, ppg: per36(r.ppg), rpg: per36(r.rpg), apg: per36(r.apg), spg: per36(r.spg), bpg: per36(r.bpg), tpg: per36(r.tpg) };
    return { ...base, ppg: r.ppg, rpg: r.rpg, apg: r.apg, spg: r.spg, bpg: r.bpg, tpg: r.tpg };
  }), [raw, mode]);
  const sorted = useSorted(rows, sort, dir);
  const n = mode === "tot" ? "int" : "1";
  const cols: Col[] = [
    { key: "full_name", label: "Player" }, { key: "gp", label: "GP", fmt: "int" }, { key: "mpg", label: mode === "tot" ? "MIN" : "MPG", fmt: n },
    { key: "ppg", label: "PTS", fmt: n }, { key: "rpg", label: "REB", fmt: n }, { key: "apg", label: "AST", fmt: n }, { key: "spg", label: "STL", fmt: n },
    { key: "bpg", label: "BLK", fmt: n }, { key: "tpg", label: "TOV", fmt: n }, { key: "fg_pct", label: "FG%", fmt: "1" }, { key: "fg3_pct", label: "3P%", fmt: "1" },
    { key: "ft_pct", label: "FT%", fmt: "1" }, { key: "ts_pct", label: "TS%", fmt: "1", title: "True shooting" }, { key: "usg_pct", label: "USG%", fmt: "1", title: "Usage rate" },
    { key: "pm", label: "+/-", fmt: "signed" }, { key: "gmsc", label: "GmSc", fmt: "1", title: "Game Score per game" },
  ];
  const onSort = (k: string) => p.set({ sort: k, dir: sort === k && dir === "desc" ? "asc" : "desc" });

  return (
    <>
      <div className="controls">
        <Select label="Season" value={season} onChange={(v) => p.set({ season: v })} options={seasons.map((s) => [s.season_id, s.season_id])} />
        <Pills label="Games" value={type} onChange={(v) => p.set({ type: v })} options={[["Regular Season", "Regular season"], ["Playoffs", "Playoffs"]]} />
        <Select label="Split" value={split} onChange={(v) => p.set({ split: v })} options={[["all", "All games"], ["last5", "Last 5"], ["last10", "Last 10"], ["home", "Home"], ["away", "Road"], ["wins", "Wins"], ["losses", "Losses"]]} />
        <Pills label="View" value={mode} onChange={(v) => p.set({ mode: v })} options={[["pg", "Per game"], ["p36", "Per 36"], ["tot", "Totals"]]} />
        <Select label="Min games" value={mingp} onChange={(v) => p.set({ mingp: v })} options={[["1", "1+"], ["3", "3+"], ["5", "5+"], ["10", "10+"], ["20", "20+"], ["41", "41+"]]} />
      </div>
      <p className="k muted" style={{ margin: "0 0 12px", fontSize: 11 }}>{loading ? "Loading…" : `${sorted.length} players · tap a column to sort`}</p>
      <SortTable cols={cols} rows={sorted} sort={sort} dir={dir} onSort={onSort} />
    </>
  );
}

/* ---------------- Lineups ---------------- */
function Lineups({ seasons, p }: { seasons: Season[]; p: ReturnType<typeof useParams> }) {
  const lineupSeasons = seasons.filter((s) => s.has_lineups);
  const season = p.get("lseason", lineupSeasons[0]?.season_id ?? "");
  const size = p.get("size", "5");
  const minmin = p.get("minmin", "25");
  const q = p.get("q", "");
  const sort = p.get("lsort", "net_rtg"), dir = p.get("ldir", "desc");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let off = false;
    setLoading(true);
    db.from("lineups").select("group_id, minutes, possessions, off_rtg, def_rtg, net_rtg, raw")
      .eq("season_id", season).eq("group_size", Number(size)).eq("garbage_filtered", false).gte("minutes", Number(minmin))
      .order("minutes", { ascending: false }).limit(400)
      .then(({ data }) => {
        if (off) return;
        setRows(((data as any[]) ?? []).map((r) => ({ _key: r.group_id, name: String(r.raw?.GROUP_NAME ?? "").split(" - ").join(" · "), minutes: r.minutes, possessions: r.possessions, off_rtg: r.off_rtg, def_rtg: r.def_rtg, net_rtg: r.net_rtg })));
        setLoading(false);
      });
    return () => { off = true; };
  }, [season, size, minmin]);

  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    return terms.length ? rows.filter((r) => terms.every((t) => r.name.toLowerCase().includes(t))) : rows;
  }, [rows, q]);
  const sorted = useSorted(filtered, sort, dir).slice(0, 60);
  const cols: Col[] = [
    { key: "name", label: "Unit" }, { key: "minutes", label: "Min", fmt: "int" }, { key: "possessions", label: "Poss", fmt: "int" },
    { key: "off_rtg", label: "Off rtg", fmt: "1" }, { key: "def_rtg", label: "Def rtg", fmt: "1" }, { key: "net_rtg", label: "Net", fmt: "signed" },
  ];
  const onSort = (k: string) => p.set({ lsort: k, ldir: sort === k && dir === "desc" ? "asc" : "desc" });

  return (
    <>
      <div className="controls">
        <Select label="Season" value={season} onChange={(v) => p.set({ lseason: v })} options={lineupSeasons.map((s) => [s.season_id, s.season_id])} />
        <Pills label="Unit size" value={size} onChange={(v) => p.set({ size: v })} options={[["5", "5-man"], ["3", "3-man"], ["2", "2-man"]]} />
        <Select label="Min minutes" value={minmin} onChange={(v) => p.set({ minmin: v })} options={[["10", "10+"], ["25", "25+"], ["50", "50+"], ["100", "100+"], ["200", "200+"], ["400", "400+"]]} />
        <label className="ctl" style={{ flex: "1 1 220px" }}>
          <span className="k muted">Must include</span>
          <input type="search" placeholder="e.g. Barnes, Poeltl" defaultValue={q} onChange={(e) => p.set({ q: e.target.value })} />
        </label>
      </div>
      <p className="k muted" style={{ margin: "0 0 12px", fontSize: 11 }}>{loading ? "Loading…" : `${filtered.length} units · per 100 possessions · tap a column to sort`}</p>
      <SortTable cols={cols} rows={sorted} sort={sort} dir={dir} onSort={onSort} />
    </>
  );
}

/* ---------------- Leaders ---------------- */
const CATS: [string, string][] = [["pts", "Points"], ["reb", "Rebounds"], ["ast", "Assists"], ["stl", "Steals"], ["blk", "Blocks"], ["fg3m", "Threes"], ["gp", "Games"]];
function Leaders({ p }: { p: ReturnType<typeof useParams> }) {
  const cat = p.get("cat", "pts");
  const scope = p.get("scope", "all");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let off = false;
    let q = db.from("v_career_totals").select("player_id, full_name, gp, pts, reb, ast, stl, blk, fg3m, last_game").order(cat, { ascending: false }).limit(25);
    if (scope === "active") q = q.gte("last_game", new Date(Date.now() - 300 * 86400000).toISOString().slice(0, 10));
    q.then(({ data }) => { if (!off) setRows(((data as any[]) ?? []).map((r, i) => ({ ...r, _key: r.player_id, rank: i + 1, per: r.gp ? Number(r[cat]) / Number(r.gp) : null }))); });
    return () => { off = true; };
  }, [cat, scope]);
  const label = CATS.find(([k]) => k === cat)?.[1] ?? cat;
  const cols: Col[] = [{ key: "rank", label: "#" }, { key: "full_name", label: "Player" }, { key: cat, label, fmt: "int" }, ...(cat === "gp" ? [] : [{ key: "per", label: "Per game", fmt: "1" } as Col]), { key: "gp", label: "GP", fmt: "int" }];
  return (
    <>
      <div className="controls">
        <Pills label="Category" value={cat} onChange={(v) => p.set({ cat: v })} options={CATS} />
        <Pills label="Players" value={scope} onChange={(v) => p.set({ scope: v })} options={[["all", "All-time"], ["active", "Current Raptors"]]} />
      </div>
      <p className="k muted" style={{ margin: "0 0 12px", fontSize: 11 }}>Regular season, as a Raptor, since 1995-96</p>
      <SortTable cols={cols} rows={rows} sort={cat} dir="desc" onSort={() => {}} />
    </>
  );
}

/* ---------------- Compare ---------------- */
function Compare({ p }: { p: ReturnType<typeof useParams> }) {
  const picked = p.get("players", "Scottie Barnes,Vince Carter,Chris Bosh,Kyle Lowry").split(",").filter(Boolean);
  const n = p.get("n", "82");
  const [options, setOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    db.from("v_career_totals").select("full_name, gp").order("gp", { ascending: false }).limit(120)
      .then(({ data }) => setOptions(((data as any[]) ?? []).map((r) => r.full_name).sort()));
  }, []);
  const key = picked.join(",");
  useEffect(() => {
    let off = false;
    db.rpc("legend_comps", { p_games: Number(n), p_names: key.split(",") }).then(({ data }) => {
      if (!off) setRows(((data as any[]) ?? []).map((r) => ({ ...r, _key: r.full_name })));
    });
    return () => { off = true; };
  }, [key, n]);
  const setSlot = (i: number, v: string) => { const next = [...picked]; if (v) next[i] = v; else next.splice(i, 1); p.set({ players: [...new Set(next)].join(",") }); };
  const cols: Col[] = [{ key: "full_name", label: "Player" }, { key: "gp", label: "Games", fmt: "int" }, { key: "ppg", label: "PPG", fmt: "1" }, { key: "rpg", label: "RPG", fmt: "1" }, { key: "apg", label: "APG", fmt: "1" }, { key: "ts_pct", label: "TS%", fmt: "1" }];
  const sorted = useSorted(rows, "ppg", "desc");
  return (
    <>
      <div className="controls">
        {[0, 1, 2, 3].map((i) => (
          <Select key={i} label={`Player ${i + 1}`} value={picked[i] ?? ""} onChange={(v) => setSlot(i, v)} options={[["", i < picked.length ? "— remove —" : "— add —"], ...options.map((o) => [o, o] as [string, string])]} />
        ))}
        <Select label="First N games as a Raptor" value={n} onChange={(v) => p.set({ n: v })} options={[["41", "41"], ["82", "82"], ["164", "164"], ["246", "246"], ["328", "328"], ["410", "410"], ["9999", "All"]]} />
      </div>
      <p className="k muted" style={{ margin: "0 0 12px", fontSize: 11 }}>Same number of games for everyone, so it&apos;s a fair fight</p>
      <SortTable cols={cols} rows={sorted} sort="ppg" dir="desc" onSort={() => {}} highlight={(r) => r.full_name === picked[0]} />
    </>
  );
}

export default function StatsExplorer({ seasons }: { seasons: Season[] }) {
  const p = useParams();
  const tab = p.get("tab", "players");
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div className="tabs" role="tablist" aria-label="Explorer">
          {TABS.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} className={tab === t.id ? "tab on" : "tab"} onClick={() => p.set({ tab: t.id })}>{t.label}</button>
          ))}
        </div>
        <button type="button" className="btn btn-o" style={{ minHeight: 44, padding: "0 18px", fontSize: 14 }} onClick={share}>{copied ? "Link copied" : "Copy link to this view"}</button>
      </div>
      {tab === "players" ? <Players seasons={seasons} p={p} /> : null}
      {tab === "lineups" ? <Lineups seasons={seasons} p={p} /> : null}
      {tab === "leaders" ? <Leaders p={p} /> : null}
      {tab === "compare" ? <Compare p={p} /> : null}
    </div>
  );
}
