/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImageResponse } from "next/og";
import { CARD_META, CARD_TYPES, CardType, getCard } from "@/lib/cards";
import { fmt } from "@/lib/data";

import { W, H, GOLD, INK, MUTED, SOFT, LILAC, PURPLE, MONO, SANS, fonts, K, Serif, Frame } from "@/lib/cardkit";

export const runtime = "nodejs";

function Empty({ type }: { type: CardType }) {
  return <Frame label={CARD_META[type].name}><div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>Raptors basketball from the 6ix.</div></Frame>;
}

function render(type: CardType, d: any) {
  switch (type) {
    case "gameday":
      return (
        <Frame label="Game Day">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", fontWeight: 800, fontSize: 150, lineHeight: 0.85, letterSpacing: -7 }}>Raptors</div>
              <div style={{ display: "flex" }}><Serif size={84}>{d.isHome ? "vs" : "at"} {d.opponent}</Serif></div>
              <div style={{ display: "flex", fontSize: 28, color: SOFT, marginTop: 8 }}>{d.when}{d.venue ? ` · ${d.venue}` : ""}</div>
            </div>
            {d.l10 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "28px 32px", borderRadius: 28, border: "1.5px solid rgba(243,238,230,.16)", background: "rgba(30,26,40,.7)", minWidth: 330 }}>
                <K size={16} color={MUTED}>Last 10 games</K>
                {[["Net rating", fmt.signed(d.l10.net)], ["Offence", fmt.n1(d.l10.ortg)], ["Defence", fmt.n1(d.l10.drtg)], ["Record", `${d.l10.wins}–${Number(d.l10.games) - Number(d.l10.wins)}`]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}><span style={{ color: SOFT }}>{k}</span><span style={{ fontFamily: MONO, color: k === "Net rating" ? GOLD : INK }}>{v}</span></div>
                ))}
                {d.out?.length ? <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 6, maxWidth: 330 }}>Out: {d.out.slice(0, 3).join(", ")}</div> : null}
              </div>
            ) : null}
          </div>
        </Frame>
      );
    case "final":
      return (
        <Frame label={`Final · ${d.date}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <K size={20} color={d.wl === "W" ? GOLD : LILAC}>{d.wl === "W" ? "Raptors win" : "Raptors fall"}</K>
              <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
                <span style={{ fontFamily: MONO, fontSize: 116, lineHeight: 1, color: d.wl === "W" ? GOLD : INK }}>{d.team_pts}</span>
                <Serif size={56} color={MUTED}>{d.is_home ? "vs" : "at"}</Serif>
                <span style={{ fontFamily: MONO, fontSize: 116, lineHeight: 1, color: d.wl === "W" ? INK : GOLD }}>{d.opp_pts}</span>
              </div>
              <div style={{ display: "flex", fontSize: 30, color: SOFT }}>Toronto vs the {d.opponent}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "26px 30px", borderRadius: 28, border: "1.5px solid rgba(243,238,230,.16)", background: "rgba(30,26,40,.7)", width: 470 }}>
              <K size={16} color={MUTED}>Top 3 · Game Score</K>
              {d.top.map((p: any, i: number) => (
                <div key={p.full_name} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderTop: i ? "1px solid rgba(243,238,230,.1)" : "none" }}>
                  <Serif size={36} color={i ? MUTED : GOLD}>{i + 1}</Serif>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <span style={{ fontSize: 26, fontWeight: 600 }}>{p.full_name}</span>
                    <span style={{ fontSize: 17, color: MUTED, fontFamily: MONO, whiteSpace: "nowrap" }}>{p.pts} PTS · {p.reb} REB · {p.ast} AST</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 28, color: GOLD }}>{fmt.n1(p.game_score)}</span>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      );
    case "gradesopen":
    case "grades": {
      const Badge = ({ g, fan }: any) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 62, height: 50, borderRadius: 14, fontWeight: 800, fontSize: 28,
          background: fan ? (g ? GOLD : "rgba(243,238,230,.06)") : "rgba(107,63,212,.32)", color: fan ? (g ? "#0A090C" : MUTED) : INK,
          border: fan ? "none" : "1.5px solid rgba(168,139,248,.6)" }}>{g ?? "–"}</div>
      );
      return (
        <Frame label={d.open ? "Grades are open" : "Jurassic Park Grades"}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5 }}>Raptors {d.game.team_pts}–{d.game.opp_pts}</span>
              <Serif size={40}>{d.game.is_home ? "vs" : "at"} {d.game.opponent}</Serif>
            </div>
            <div style={{ display: "flex", gap: 22 }}><K size={15} color={LILAC}>Lab</K><K size={15}>{d.open ? "You?" : `Fan consensus${d.voters ? ` · ${d.voters}` : ""}`}</K></div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", columnGap: 28 }}>
            {d.rows.map((r: any) => (
              <div key={r.full_name} style={{ display: "flex", alignItems: "center", gap: 12, width: 530, padding: "8px 0", borderTop: "1px solid rgba(243,238,230,.1)" }}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <span style={{ fontSize: 24, fontWeight: 600 }}>{r.full_name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 15, color: MUTED, whiteSpace: "nowrap" }}>{r.pts} PTS · {r.reb} REB · {r.ast} AST · {Number(r.plus_minus) > 0 ? "+" : ""}{r.plus_minus}</span>
                </div>
                <Badge g={r.lab} />
                <Badge g={d.open ? "?" : r.fan} fan />
              </div>
            ))}
          </div>
        </Frame>
      );
    }
    case "trivia":
      return (
        <Frame label="Raptors Trivia">
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div style={{ display: "flex", fontSize: 50, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1000 }}>{d.q}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {d.options.map((o: string, i: number) => (
                <div key={o} style={{ display: "flex", alignItems: "center", gap: 14, width: 520, padding: "16px 22px", borderRadius: 18, border: "1.5px solid rgba(243,238,230,.18)", background: "rgba(30,26,40,.7)" }}>
                  <span style={{ fontFamily: MONO, fontSize: 22, color: GOLD }}>{"ABCD"[i]}</span><span style={{ fontSize: 28, fontWeight: 600 }}>{o}</span>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      );
    case "record": {
      const r = d.lead;
      return (
        <Frame label="Record Watch">
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
              <span style={{ fontFamily: MONO, fontSize: 230, lineHeight: 0.9, color: GOLD }}>{fmt.int(r.gap)}</span>
              <K size={24} color={SOFT}>{r.category} to go</K>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: 54, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
                {r.full_name} is chasing {r.next_name}
              </div>
              <div style={{ display: "flex", fontSize: 30, color: SOFT }}>for #{Number(r.rank_now) - 1} on the Raptors&apos; all-time {r.category} list.</div>
              <div style={{ display: "flex", gap: 30, marginTop: 6 }}>
                <div style={{ display: "flex", flexDirection: "column" }}><K size={15} color={MUTED}>{r.full_name.split(" ").pop()}</K><span style={{ fontFamily: MONO, fontSize: 40 }}>{fmt.int(r.total)}</span></div>
                <div style={{ display: "flex", flexDirection: "column" }}><K size={15} color={MUTED}>{r.next_name.split(" ").pop()}</K><span style={{ fontFamily: MONO, fontSize: 40, color: GOLD }}>{fmt.int(r.next_total)}</span></div>
              </div>
            </div>
          </div>
        </Frame>
      );
    }
    case "onthisday":
      return (
        <Frame label="On This Day">
          <div style={{ position: "absolute", right: -10, top: -60, display: "flex" }}><Serif size={420} color="rgba(243,238,230,.08)">&apos;{String(d.game_date).slice(2, 4)}</Serif></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
            <K size={22}>{d.date}{d.season_type === "Playoffs" ? " · Playoffs" : ""}</K>
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>
              Raptors {d.verb} the {d.opponent} {d.team_pts}–{d.opp_pts}
            </div>
            {d.top_name ? <div style={{ display: "flex", fontSize: 34, color: SOFT }}>{d.top_name} led the way with {d.top_pts} points.</div> : null}
            <div style={{ display: "flex", marginTop: 4 }}><Serif size={40}>Here since the purple days.</Serif></div>
          </div>
        </Frame>
      );
    case "report": {
      const Row = ({ r, up }: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 300 }}>
            <span style={{ fontSize: 27, fontWeight: 600 }}>{r.full_name}</span>
            <span style={{ fontFamily: MONO, fontSize: 17, color: MUTED }}>{fmt.n1(r.ts_last5)}% TS last 5</span>
          </div>
          <div style={{ display: "flex", flex: 1, height: 10, borderRadius: 5, background: "rgba(243,238,230,.1)" }}>
            <div style={{ display: "flex", width: `${Math.max(8, (Math.abs(Number(r.ts_delta)) / d.max) * 100)}%`, height: 10, borderRadius: 5, background: up ? `linear-gradient(90deg, ${PURPLE}, ${GOLD})` : PURPLE }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 28, width: 90, textAlign: "right", color: up ? GOLD : LILAC }}>{fmt.signed(r.ts_delta)}</span>
        </div>
      );
      return (
        <Frame label="The 401 Report">
          <div style={{ display: "flex", gap: 56 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <K size={20}>↑ Express lane</K>
              {d.up.map((r: any) => <Row key={r.full_name} r={r} up />)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <K size={20} color={LILAC}>↓ Collectors</K>
              {d.down.map((r: any) => <Row key={r.full_name} r={r} />)}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED, marginTop: 14 }}>True shooting, last 5 games vs season</div>
        </Frame>
      );
    }
    case "lineup":
      return (
        <Frame label="Lineup Lab">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
              <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2 }}>Trios that win their</span><Serif size={60}>minutes</Serif>
            </div>
            {d.best.map((u: any, i: number) => (
              <div key={u.group_id} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 0", borderTop: i ? "1px solid rgba(243,238,230,.1)" : "none" }}>
                <Serif size={40} color={i ? MUTED : GOLD}>{i + 1}</Serif>
                <span style={{ flex: 1, fontSize: 32, fontWeight: 600 }}>{u.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 20, color: MUTED, width: 120, textAlign: "right" }}>{Math.round(u.minutes)} min</span>
                <span style={{ fontFamily: MONO, fontSize: 40, color: GOLD, width: 150, textAlign: "right" }}>{fmt.signed(u.net_rtg)}</span>
              </div>
            ))}
            {d.worst ? (
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 14, padding: "14px 20px", borderRadius: 18, background: "rgba(107,63,212,.18)" }}>
                <K size={15} color={LILAC}>Bleeding</K>
                <span style={{ flex: 1, fontSize: 26 }}>{d.worst.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 30, color: LILAC }}>{fmt.signed(d.worst.net_rtg)}</span>
              </div>
            ) : null}
          </div>
        </Frame>
      );
    case "legends":
      return (
        <Frame label="Same Age, Same Jersey">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10 }}>
              <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: -2 }}>First {d.games} games as a Raptor</span>
            </div>
            <div style={{ display: "flex", fontFamily: MONO, fontSize: 16, color: MUTED, letterSpacing: 2, padding: "8px 0", borderBottom: "1px solid rgba(243,238,230,.15)" }}>
              <span style={{ flex: 1 }}>PLAYER</span><span style={{ width: 120, textAlign: "right" }}>PPG</span><span style={{ width: 120, textAlign: "right" }}>RPG</span><span style={{ width: 120, textAlign: "right" }}>APG</span><span style={{ width: 130, textAlign: "right" }}>TS%</span>
            </div>
            {d.rows.map((r: any) => {
              const me = r.full_name === "Scottie Barnes";
              return (
                <div key={r.full_name} style={{ display: "flex", alignItems: "center", padding: "9px 0", fontSize: 27, color: me ? GOLD : INK, fontWeight: me ? 800 : 400 }}>
                  <span style={{ flex: 1 }}>{r.full_name}</span>
                  <span style={{ width: 120, textAlign: "right", fontFamily: MONO }}>{fmt.n1(r.ppg)}</span>
                  <span style={{ width: 120, textAlign: "right", fontFamily: MONO }}>{fmt.n1(r.rpg)}</span>
                  <span style={{ width: 120, textAlign: "right", fontFamily: MONO }}>{fmt.n1(r.apg)}</span>
                  <span style={{ width: 130, textAlign: "right", fontFamily: MONO }}>{fmt.n1(r.ts_pct)}</span>
                </div>
              );
            })}
          </div>
        </Frame>
      );
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(CARD_TYPES as readonly string[]).includes(type)) return new Response("Not found", { status: 404 });
  const t = type as CardType;
  const card = await getCard(t).catch(() => null);
  if (card?.image) return Response.redirect(card.image, 302);
  return new ImageResponse(card ? render(t, card.data)! : <Empty type={t} />, {
    width: W,
    height: H,
    fonts: await fonts(),
    headers: { "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=600" },
  });
}
