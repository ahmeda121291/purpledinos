"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useMemo, useState } from "react";

export default function PlayerIndex({ players }: { players: any[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"gp" | "ppg" | "name">("gp");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = t ? players.filter((p) => p.full_name.toLowerCase().includes(t)) : players;
    return [...f].sort((a, b) => (sort === "name" ? a.full_name.localeCompare(b.full_name) : b[sort] - a[sort]));
  }, [players, q, sort]);
  return (
    <div>
      <div className="controls">
        <label className="ctl" style={{ flex: "1 1 260px" }}>
          <span className="k muted">Find a Raptor</span>
          <input type="search" placeholder="Vince, Kawhi, Fred…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="ctl">
          <span className="k muted">Sort</span>
          <div className="pills">
            {([["gp", "Most games"], ["ppg", "Scoring"], ["name", "A–Z"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={sort === k ? "pill on" : "pill"} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="k muted" style={{ fontSize: 11, margin: "0 0 12px" }}>{list.length} players</p>
      <div className="glass scroll" style={{ padding: "8px 22px" }}>
        <table className="t">
          <thead><tr><th>Player</th><th>Years</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.player_id}>
                <td><Link className="ul" href={`/players/${p.slug}`} style={{ color: "var(--ink)", fontWeight: 600 }}>{p.full_name}</Link></td>
                <td>{p.years}</td><td>{p.gp}</td><td><b>{p.ppg.toFixed(1)}</b></td><td>{p.rpg.toFixed(1)}</td><td>{p.apg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
