"use client";
import { useEffect, useState } from "react";

function parts(target: number) {
  const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return { d: Math.floor(s / 86400), h: p(Math.floor((s % 86400) / 3600)), m: p(Math.floor((s % 3600) / 60)), s: p(s % 60) };
}

export default function Countdown({ tipISO }: { tipISO: string }) {
  const target = Date.parse(tipISO);
  const [t, setT] = useState<ReturnType<typeof parts> | null>(null);
  useEffect(() => {
    setT(parts(target));
    const id = setInterval(() => setT(parts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  const cell = (v: string, label: string, gold = false, first = false) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 24px", borderLeft: first ? "none" : "1px solid rgba(243,238,230,.12)" }}>
      <span style={{ fontSize: 44, fontWeight: 500, lineHeight: 1, minWidth: "2ch", textAlign: "center", color: gold ? "var(--gold)" : undefined }}>{v}</span>
      <span className="k muted" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
  return (
    <div className="glass mono" role="timer" aria-label="Countdown to tip-off" style={{ display: "flex", alignItems: "stretch", borderRadius: 22 }}>
      {t && t.d > 0 ? cell(String(t.d), "days", false, true) : null}
      {cell(t?.h ?? "--", "hrs", false, !(t && t.d > 0))}
      {cell(t?.m ?? "--", "min")}
      {cell(t?.s ?? "--", "sec", true)}
    </div>
  );
}
