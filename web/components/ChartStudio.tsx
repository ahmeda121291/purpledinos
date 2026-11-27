"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/supabase";
import { track } from "./Analytics";
import Tip from "./Tip";
import MetricSelect from "./MetricSelect";
import { METRIC } from "@/lib/metrics";

type P = { get: (k: string, d: string) => string; set: (patch: Record<string, string | null>) => void };
type Season = { season_id: string };

const KINDS: [string, string, string][] = [["bar", "Leaderboard", "Who leads in any stat"], ["quadrant", "Quadrant", "Two stats, four types of player"], ["line", "Trend", "One player over time"], ["compare", "Head-to-head", "Up to 4 Raptors, same games"]];
const KEYS: Record<string, string[]> = {
  bar: ["kind", "src", "cat", "metric", "season", "type", "split", "mingp", "mode"],
  quadrant: ["kind", "x", "y", "season", "type", "split", "mingp"],
  line: ["kind", "player", "metric", "scope", "season"],
  compare: ["kind", "players", "n"],
  table: ["kind", "tab", "season", "type", "split", "mode", "mingp", "sort", "dir", "lseason", "size", "minmin", "q", "lsort", "ldir", "cat", "scope", "players", "n"],
};

export function vizQuery(sp: URLSearchParams, kind: string) {
  const out = new URLSearchParams({ kind });
  for (const k of KEYS[kind] ?? []) { const v = sp.get(k); if (v && k !== "kind") out.set(k, v); }
  return out.toString();
}

export function ShareActions({ qs, label = "image", compact = false }: { qs: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const page = `https://purpledinos.ca/v?${qs}`;
  const intent = `https://x.com/intent/post?text=${encodeURIComponent("Made this in the Purple Dinos Stats Lab 🦖 via @PurpleDinosTO")}&url=${encodeURIComponent(page)}`;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <a className={compact ? "btn btn-o sm" : "btn btn-g"} href={`/api/viz?${qs}&dl=1`} download onClick={() => track("viz_download", { qs })}>⤓ Download {label}</a>
      <a className="btn btn-o sm" href={intent} target="_blank" rel="noopener" onClick={() => track("viz_share_x", { qs })}>Post it on X</a>
      <button type="button" className="btn btn-o sm" onClick={async () => { try { await navigator.clipboard.writeText(page); setCopied(true); track("viz_copy_link", { qs }); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } }}>{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
}

function Sel({ label, value, onChange, options, tip }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; tip?: string }) {
  return (
    <label className="ctl">
      <span className="k muted">{label}{tip ? <Tip term={tip} /> : null}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}

export default function ChartStudio({ p, sp, seasons }: { p: P; sp: URLSearchParams; seasons: Season[] }) {
  const kind = p.get("kind", "bar");
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    db.from("v_career_totals").select("full_name, gp").order("gp", { ascending: false }).limit(160).then(({ data }) => setNames(((data as any[]) ?? []).map((r) => r.full_name).sort()));
  }, []);
  const qs = useMemo(() => vizQuery(sp, kind), [sp, kind]);
  useEffect(() => setLoading(true), [qs]);
  const seasonOpts = seasons.map((s) => [s.season_id, s.season_id] as [string, string]);
  const season = p.get("season", seasons[0]?.season_id ?? "");
  const nameOpts = names.map((n) => [n, n] as [string, string]);
  const players = p.get("players", "Scottie Barnes,Vince Carter,Chris Bosh,Kyle Lowry").split(",").filter(Boolean);

  const common = (
    <>
      <Sel label="Season" value={season} onChange={(v) => p.set({ season: v })} options={seasonOpts} />
      <Sel label="Games" value={p.get("type", "Regular Season")} onChange={(v) => p.set({ type: v })} options={[["Regular Season", "Regular season"], ["Playoffs", "Playoffs"]]} />
      <Sel label="Split" value={p.get("split", "all")} onChange={(v) => p.set({ split: v })} options={[["all", "All games"], ["last5", "Last 5"], ["last10", "Last 10"], ["home", "Home"], ["away", "Road"], ["wins", "Wins"], ["losses", "Losses"]]} />
      <Sel label="Min games" value={p.get("mingp", "3")} onChange={(v) => p.set({ mingp: v })} options={[["1", "1+"], ["3", "3+"], ["5", "5+"], ["10", "10+"], ["20", "20+"], ["41", "41+"]]} />
    </>
  );

  return (
    <div>
      <div className="kinds" role="group" aria-label="Chart type">
        {KINDS.map(([k, l, d]) => (
          <button key={k} type="button" className={kind === k ? "kind on" : "kind"} aria-pressed={kind === k} onClick={() => { p.set({ kind: k }); track("viz_kind", { kind: k }); }}>
            <b>{l}</b><span>{d}</span>
          </button>
        ))}
      </div>
      <div className="controls" style={{ marginTop: 18 }}>
        {kind === "bar" ? (
          <>
            <Sel label="Scope" value={p.get("src", "players")} onChange={(v) => p.set({ src: v === "players" ? null : v })} options={[["players", "One season"], ["leaders", "All-time leaders"]]} />
            {p.get("src", "players") === "leaders" ? (
              <Sel label="Category" value={p.get("cat", "pts")} onChange={(v) => p.set({ cat: v })} options={[["pts", "Points"], ["reb", "Rebounds"], ["ast", "Assists"], ["stl", "Steals"], ["blk", "Blocks"], ["fg3m", "Threes"], ["gp", "Games"]]} />
            ) : (
              <>
                <MetricSelect label="Stat" value={p.get("metric", "ppg")} onChange={(v) => p.set({ metric: v })} only={(k) => k !== "fg3pg" && k !== "rel_ts" && k !== "pts_share"} />
                <Sel label="View" tip="per36" value={p.get("mode", "pg")} onChange={(v) => p.set({ mode: v })} options={[["pg", "Per game"], ["p36", "Per 36"], ["tot", "Totals"]]} />
                {common}
              </>
            )}
          </>
        ) : null}
        {kind === "quadrant" ? (
          <>
            <MetricSelect label="Across (X)" value={p.get("x", "usg_pct")} onChange={(v) => p.set({ x: v })} only={(k) => k !== "fg3pg" && k !== "rel_ts" && k !== "pts_share"} />
            <MetricSelect label="Up (Y)" value={p.get("y", "ts_pct")} onChange={(v) => p.set({ y: v })} only={(k) => k !== "fg3pg" && k !== "rel_ts" && k !== "pts_share"} />
            {common}
          </>
        ) : null}
        {kind === "line" ? (
          <>
            <Sel label="Player" value={p.get("player", "Scottie Barnes")} onChange={(v) => p.set({ player: v })} options={nameOpts.length ? nameOpts : [["Scottie Barnes", "Scottie Barnes"]]} />
            <MetricSelect label="Stat" value={p.get("metric", "ppg")} onChange={(v) => p.set({ metric: v })} only={(k) => p.get("scope", "games") === "seasons" ? true : Boolean(METRIC[k]?.game)} />
            <Sel label="Over" value={p.get("scope", "games")} onChange={(v) => p.set({ scope: v })} options={[["games", "Game by game"], ["seasons", "Season by season"]]} />
            {p.get("scope", "games") === "games" ? <Sel label="Season" value={season} onChange={(v) => p.set({ season: v })} options={seasonOpts} /> : null}
          </>
        ) : null}
        {kind === "compare" ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Sel key={i} label={`Player ${i + 1}`} value={players[i] ?? ""} onChange={(v) => { const n = [...players]; if (v) n[i] = v; else n.splice(i, 1); p.set({ players: [...new Set(n)].join(",") }); }}
                options={[["", i < players.length ? "— remove —" : "— add —"], ...nameOpts]} />
            ))}
            <Sel label="First N games" value={p.get("n", "82")} onChange={(v) => p.set({ n: v })} options={[["41", "41"], ["82", "82"], ["164", "164"], ["246", "246"], ["328", "328"], ["9999", "All"]]} />
          </>
        ) : null}
      </div>
      <div className="glass viz-frame" style={{ padding: 10, position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={qs} src={`/api/viz?${qs}`} alt="Chart preview" width={1200} height={675} onLoad={() => setLoading(false)} style={{ width: "100%", height: "auto", display: "block", borderRadius: 20, opacity: loading ? 0.35 : 1, transition: "opacity .3s" }} />
        {loading ? <div className="k gold" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>Drawing…</div> : null}
      </div>
      <div style={{ marginTop: 18 }}><ShareActions qs={qs} label="chart" /></div>
      <p className="k muted" style={{ fontSize: 11, marginTop: 14 }}>Every chart has its own link. Post it and the chart shows up as the preview.</p>
    </div>
  );
}
