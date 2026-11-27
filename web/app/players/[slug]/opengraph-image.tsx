/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImageResponse } from "next/og";
import { W, H, GOLD, MUTED, SOFT, MONO, fonts, K, Serif, Frame } from "@/lib/cardkit";
import { getPlayerBySlug, getPlayerProfile } from "@/lib/players";

export const runtime = "nodejs";
export const size = { width: W, height: H };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPlayerBySlug(slug);
  const prof = p ? await getPlayerProfile(Number(p.player_id)) : null;
  const c: any = prof?.career;
  const top = (prof?.ranks ?? []).filter((r: any) => Number(r.rank) <= 10).slice(0, 3);
  const parts = (p?.full_name ?? "Purple Dinos").split(" ");
  return new ImageResponse(
    <Frame label="Raptors résumé">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 96, fontWeight: 800, letterSpacing: -4, lineHeight: 0.95 }}>{parts.slice(0, -1).join(" ")}</span>
          <Serif size={110}>{parts.slice(-1)[0]}</Serif>
        </div>
        {c ? (
          <div style={{ display: "flex", gap: 44 }}>
            {[["GP", c.gp], ["PPG", Number(c.ppg).toFixed(1)], ["RPG", Number(c.rpg).toFixed(1)], ["APG", Number(c.apg).toFixed(1)], ["TS%", Number(c.ts_pct).toFixed(1)]].map(([k, v]: any) => (
              <div key={k} style={{ display: "flex", flexDirection: "column" }}><K size={16} color={MUTED}>{k}</K><span style={{ fontFamily: MONO, fontSize: 52, color: k === "PPG" ? GOLD : "#F3EEE6" }}>{v}</span></div>
            ))}
          </div>
        ) : null}
        {top.length ? <div style={{ display: "flex", fontSize: 28, color: SOFT }}>{top.map((r: any) => `#${r.rank} all-time in ${r.category}`).join("  ·  ")}</div> : null}
      </div>
    </Frame>,
    { ...size, fonts: await fonts() },
  );
}
