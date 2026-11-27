"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useEffect, useState } from "react";
import { playerHref } from "@/lib/slug";
import { track } from "./Analytics";
import Tip from "./Tip";

const GRADES = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];
const pm = (v: any) => (Number(v) > 0 ? `+${v}` : `${v}`);

export function GradeBadge({ g, kind, size = 52 }: { g: string | null; kind: "lab" | "fan"; size?: number }) {
  return (
    <span className={`gb gb-${kind}${g ? "" : " gb-empty"}`} style={{ width: size, height: size * 0.82, fontSize: size * 0.42 }} aria-label={`${kind === "lab" ? "Lab" : "Fan"} grade ${g ?? "none yet"}`}>
      {g ?? "–"}
    </span>
  );
}

export default function GradeBoard({ gameId, rows: initial, open }: { gameId: string; rows: any[]; open: boolean }) {
  const [rows, setRows] = useState(initial);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const store = `pd_votes_${gameId}`;

  useEffect(() => {
    try { setMine(JSON.parse(localStorage.getItem(store) ?? "{}")); } catch { /* storage unavailable */ }
  }, [store]);

  async function vote(player_id: number, grade: string) {
    setBusy(`${player_id}`); setMsg(null);
    const next = { ...mine, [player_id]: grade };
    setMine(next);
    try { localStorage.setItem(store, JSON.stringify(next)); } catch { /* ignore */ }
    try {
      const res = await fetch("/api/grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game_id: gameId, player_id, grade }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Vote didn't go through");
      if (body.row) setRows((rs) => rs.map((r) => (Number(r.player_id) === player_id ? { ...r, ...body.row } : r)));
      track("grade_submitted", { game_id: gameId, player_id, grade });
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  const done = Object.keys(mine).length;
  const total = rows.filter((r) => r.lab !== "INC").length;

  return (
    <div>
      {open ? (
        <div className="k muted" style={{ marginBottom: 16, fontSize: 11 }} aria-live="polite">
          {done ? <><span className="gold">{done}/{total}</span> graded · change any grade until voting closes</> : "Tap a grade under each player. Lab = the numbers. Fans = everyone's average. You = yours."}
          {msg ? <span style={{ color: "#E5484D", marginLeft: 10 }}>{msg}</span> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r) => {
          const id = Number(r.player_id);
          const inc = r.lab === "INC";
          const diff = r.fan && !inc ? GRADES.indexOf(r.lab) - GRADES.indexOf(r.fan) : 0;
          return (
            <article key={id} className="glass gcard" style={{ padding: "18px 20px", opacity: inc ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <Link href={playerHref(r.full_name)} className="ul" style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{r.full_name}</Link>
                  <div className="mono muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {Math.round(Number(r.minutes))} MIN · <b className="ink">{r.pts}</b> PTS · {r.reb} REB · {r.ast} AST · {r.fgm}/{r.fga} FG · {pm(r.plus_minus)}
                  </div>
                  <div className="mono muted" style={{ fontSize: 12, marginTop: 2 }}>Game Score {r.game_score}<Tip term="gmsc" /> · TS {r.ts_pct ?? "—"}%<Tip term="ts" /></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <GradeBadge g={inc ? "INC" : r.lab} kind="lab" size={50} />
                    <span className="k" style={{ fontSize: 10, color: "#B9A4F0" }}>Lab<Tip term="lab" /></span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <GradeBadge g={r.fan} kind="fan" size={50} />
                    <span className="k gold" style={{ fontSize: 10 }}>Fans{Number(r.votes) ? ` · ${r.votes}` : ""}<Tip term="fan" /></span>
                  </div>
                  {open && !inc ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span className={`gb ${mine[id] ? "gb-you" : "gb-empty"}`} style={{ width: 50, height: 41, fontSize: 21 }}>{mine[id] ?? "?"}</span>
                      <span className="k" style={{ fontSize: 10, color: "var(--ink)" }}>You</span>
                    </div>
                  ) : null}
                </div>
              </div>
              {Math.abs(diff) >= 2 ? (
                <p className="soft" style={{ margin: "12px 0 0", fontSize: 14 }}>
                  {diff > 0 ? "Fans are higher on him than the numbers." : "The numbers like him more than you do."}
                </p>
              ) : null}
              {open && !inc ? (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(243,238,230,.1)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="k gold" style={{ fontSize: 11 }}>Your grade</span>
                <div className="pills" role="group" aria-label={`Your grade for ${r.full_name}`}>
                  {GRADES.map((g) => (
                    <button key={g} type="button" disabled={busy === `${id}`} className={mine[id] === g ? "pill on" : "pill"} aria-pressed={mine[id] === g} onClick={() => vote(id, g)} style={{ minWidth: 48, padding: "0 12px", fontWeight: 700 }}>
                      {g}
                    </button>
                  ))}
                </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
