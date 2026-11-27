/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import PostCard, { type FeedPost } from "@/components/PostCard";
import { Header, Footer, X_URL } from "@/components/Chrome";
import Countdown from "@/components/Countdown";
import { fmt, getCurrentSeason, getLastGame, getLineups, getOnThisDay, getRecordBook, getRecordWatch, getSeasonPulse, getTrendReport } from "@/lib/data";
import { getHeadlines, getInjuries, getNextGame, timeAgo } from "@/lib/feeds";
import { teamName } from "@/lib/teams";
import { db } from "@/lib/supabase";
import { playerHref } from "@/lib/slug";
import { getLatestGrades } from "@/lib/cards";
import { GradeBadge } from "@/components/GradeBoard";
import Tip from "@/components/Tip";

export const revalidate = 600;

const tz = "America/Toronto";
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: tz, weekday: "long", month: "short", day: "numeric" });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-CA", { timeZone: tz, hour: "numeric", minute: "2-digit" }).replace(/\./g, "").toUpperCase();
const sameDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: tz }) === new Date().toLocaleDateString("en-CA", { timeZone: tz });
const longDate = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });

export default async function Home() {
  const [next, injuries, pulse, last, trend, watch, lineups, otd, book, news, season, grades] = await Promise.all([
    getNextGame(), getInjuries(), getSeasonPulse(), getLastGame(), getTrendReport(), getRecordWatch(8),
    getLineups(3, 60, 4), getOnThisDay(), getRecordBook(1), getHeadlines(6), getCurrentSeason(), getLatestGrades().catch(() => null),
  ]);
  const { data: feedRows } = await db.from("v_feed").select("*").gte("created_at", new Date(Date.now() - 36 * 3600000).toISOString()).order("score", { ascending: false }).limit(4);
  const feed = (feedRows as FeedPost[]) ?? [];

  const sp = pulse.find((p: any) => p.span === "season");
  const l10 = pulse.find((p: any) => p.span === "last10");
  const risers = trend.filter((t: any) => Number(t.ts_delta) > 0).slice(0, 3);
  const fallers = [...trend].reverse().filter((t: any) => Number(t.ts_delta) < 0).slice(0, 3);
  const maxDelta = Math.max(1, ...trend.map((t: any) => Math.abs(Number(t.ts_delta))));
  const star = last?.top?.[0];
  const gameDay = next ? sameDay(next.tipISO) : false;
  const bookOrder = ["PTS", "AST", "REB", "STL", "FG3M"];
  const bookRows = bookOrder.map((c) => book.find((b) => b.category === c)).filter(Boolean) as any[];

  const watchItems = watch.map((w: any, i: number) => (
    <span key={i} style={{ display: "contents" }}>
      <span>
        <Link className="ul" href={playerHref(w.full_name)} style={{ color: "var(--ink)", fontWeight: 700 }}>{w.full_name}</Link> is <span className="mono gold">{fmt.int(w.gap)}</span> {w.category} from passing{" "}
        <strong style={{ color: "var(--ink)" }}>{w.next_name}</strong> for <span className="mono gold">#{Number(w.rank_now) - 1}</span> all-time
      </span>
      <span aria-hidden="true" className="dot" style={{ width: 5, height: 5, background: "var(--gold)" }} />
    </span>
  ));

  const pulseRow = (label: string, sub: string | null, a: any, b: any, invert = false, suffix = "") => {
    const d = a !== undefined && b !== undefined ? Number(b) - Number(a) : null;
    const good = d === null ? null : invert ? d < 0 : d > 0;
    return (
      <div className="row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) repeat(3,minmax(0,1fr))", gap: 8, alignItems: "center", padding: "15px 12px", borderTop: "1px solid rgba(243,238,230,.07)" }}>
        <span style={{ fontWeight: 600 }}>{label}{sub ? <span style={{ display: "block", fontWeight: 400, fontSize: 13 }} className="muted">{sub}</span> : null}</span>
        <span className="mono" style={{ textAlign: "right" }}>{fmt.n1(a)}{suffix}</span>
        <span className="mono" style={{ textAlign: "right" }}>{fmt.n1(b)}{suffix}</span>
        <span className="mono" style={{ textAlign: "right", color: good === null ? undefined : good ? "var(--gold)" : "#B9A4F0" }}>{fmt.signed(d)}</span>
      </div>
    );
  };

  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="home" />

      <section id="tonight" style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid rgba(243,238,230,.1)" }}>
        <div aria-hidden="true" className="drift" style={{ position: "absolute", left: "-6%", top: -260, width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,63,212,.55), rgba(107,63,212,0) 65%)" }} />
        <div aria-hidden="true" className="drift2" style={{ position: "absolute", right: "-8%", bottom: -260, width: 720, height: 720, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,184,120,.16), rgba(217,184,120,0) 65%)" }} />
        <Skyline />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,9,12,.2), rgba(10,9,12,.55) 70%, rgba(10,9,12,.9))" }} />

        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: 88, paddingBottom: 128, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(460px, 100%), 1fr))", gap: 56, alignItems: "center" }}>
          <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="k" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "9px 16px", borderRadius: 999, border: "1px solid rgba(243,238,230,.25)", background: "rgba(10,9,12,.5)" }}>
                <span className={gameDay ? "live dot" : "dot"} style={{ width: 8, height: 8, background: gameDay ? "#E5484D" : "var(--gold)" }} />
                {gameDay ? "Game day" : "Next up"}
              </span>
              {season ? <span className="k gold">{season.season_id} · {season.wins}–{season.losses}</span> : null}
            </div>
            {next ? (
              <>
                <h1 style={{ margin: 0, fontWeight: 800, lineHeight: 0.86, letterSpacing: "-.05em", fontSize: "clamp(64px, 10.5vw, 156px)" }}>
                  Raptors<br />
                  <span className="se" style={{ fontSize: ".5em", lineHeight: 1.2 }}>{next.isHome ? "vs" : "at"} {next.opponent}</span>
                </h1>
                <p className="soft" style={{ margin: 0, fontSize: 18 }}>
                  {gameDay ? "Tonight" : dayLabel(next.tipISO)} <span className="gold">·</span> {timeLabel(next.tipISO)} ET
                  {next.venue ? <> <span className="gold">·</span> {next.venue}</> : null}
                  {next.tv ? <> <span className="gold">·</span> {next.tv}</> : null}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                  <span className="k muted">Tip-off in</span>
                  <Countdown tipISO={next.tipISO} />
                </div>
              </>
            ) : (
              <h1 style={{ margin: 0, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-.05em", fontSize: "clamp(56px, 9vw, 132px)" }}>
                Raptors<br /><span className="se" style={{ fontSize: ".5em" }}>from the 6ix</span>
              </h1>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-g" href="/stats-lab">Open the Stats Lab <span aria-hidden="true">→</span></Link>
              <a className="btn btn-o" href={X_URL}>Follow on X</a>
            </div>
          </div>

          {sp && l10 ? (
            <aside className="glass rise" aria-label="Season pulse" style={{ animationDelay: ".2s", minWidth: 0, padding: 32, background: "linear-gradient(160deg, rgba(30,26,40,.82), rgba(14,12,18,.82))", boxShadow: "0 40px 120px rgba(0,0,0,.6)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
                <h2 style={{ margin: 0, fontWeight: 800, fontSize: 30, letterSpacing: "-.03em" }}>Season <span className="se" style={{ fontSize: 34 }}>Pulse</span></h2>
                <span className="k muted" style={{ fontSize: 11 }}>Per 100 possessions</span>
              </div>
              <div className="k muted" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) repeat(3,minmax(0,1fr))", gap: 8, padding: "0 12px 10px", fontSize: 11, borderBottom: "1px solid rgba(243,238,230,.14)" }}>
                <span>Metric</span><span style={{ textAlign: "right" }}>Season</span><span style={{ textAlign: "right" }}>Last 10</span><span className="gold" style={{ textAlign: "right" }}>Trend</span>
              </div>
              {pulseRow("Net rating", null, sp.net, l10.net)}
              {pulseRow("Offence", "points per 100", sp.ortg, l10.ortg)}
              {pulseRow("Defence", "allowed per 100", sp.drtg, l10.drtg, true)}
              {pulseRow("TTC Delays", "turnover rate", sp.tov_pct, l10.tov_pct, true, "%")}
              {pulseRow("True shooting", null, sp.ts_pct, l10.ts_pct, false, "%")}
              <div style={{ marginTop: 14, paddingTop: 18, borderTop: "1px solid rgba(243,238,230,.14)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="k muted" style={{ fontSize: 11 }}>Injury report</span>
                {injuries.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {injuries.slice(0, 6).map((i) => (
                      <span key={i.name} className="chip" title={i.detail}>
                        <span className="dot" style={{ background: /out/i.test(i.status) ? "#E5484D" : /question|doubt/i.test(i.status) ? "var(--gold)" : "var(--ink)" }} />
                        {i.name} <span className="muted">{i.status}</span>
                      </span>
                    ))}
                  </div>
                ) : <span className="soft" style={{ fontSize: 14 }}>No one listed right now.</span>}
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      {watch.length ? (
        <section aria-label="Record Watch" style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: "clamp(16px,3vw,32px)", borderBottom: "1px solid rgba(243,238,230,.1)" }}>
          <span className="se" style={{ flex: "none", fontSize: 26, paddingRight: 16, borderRight: "1px solid rgba(243,238,230,.14)" }}>Record Watch</span>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
            <div className="marq" style={{ display: "flex", width: "max-content" }}>
              <div className="soft" style={{ display: "flex", alignItems: "center", gap: 44, padding: "20px 44px 20px 28px", whiteSpace: "nowrap" }}>{watchItems}</div>
              <div className="soft" aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 44, padding: "20px 44px 20px 28px", whiteSpace: "nowrap" }}>{watchItems}</div>
            </div>
          </div>
        </section>
      ) : null}

      <section id="postgame" className="wrap sec">
        <div className="sechead">
          <div><div className="k gold" style={{ marginBottom: 12 }}>01 — The numbers desk</div><h2 className="h2">Last game, <span className="se" style={{ fontSize: "1.1em" }}>decoded</span></h2></div>
          <Link href="/stats-lab" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600 }}>Open the Stats Lab →</Link>
        </div>
        <div className="grid-auto">
          {last ? (
            <article className="glass lift rise" style={{ display: "flex", flexDirection: "column", gap: 18, padding: 30, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="k muted">{longDate(last.game.game_date)}</span>
                <span className="k" style={{ padding: "5px 12px", borderRadius: 999, background: last.game.wl === "W" ? "var(--gold)" : "var(--ink)", color: "var(--bg)", fontWeight: 700 }}>Final · {last.game.wl}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="gold" style={{ fontWeight: 700 }}>TOR</span><span className="mono" style={{ fontSize: 52, lineHeight: 1.1 }}>{last.game.team_pts}</span></div>
                <span className="se muted" style={{ fontSize: 26, paddingBottom: 12 }}>{last.game.is_home ? "vs" : "at"}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}><span className="muted" style={{ fontWeight: 700 }}>{last.game.opponent_abbr}</span><span className="mono" style={{ fontSize: 52, lineHeight: 1.1 }}>{last.game.opp_pts}</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(243,238,230,.12)" }}>
                <div className="k muted" style={{ display: "flex", justifyContent: "space-between", padding: "12px 8px 6px", fontSize: 11 }}><span>Top 3 by Game Score<Tip term="gmsc" /></span><span>GmSc</span></div>
                {last.top.map((p: any, i: number) => (
                  <div key={p.full_name} className="row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px" }}>
                    <span className="se" style={{ fontSize: 24, width: 22, lineHeight: 1, color: i ? "var(--muted)" : undefined }}>{i + 1}</span>
                    <span style={{ flex: 1 }}><Link className="ul" href={playerHref(p.full_name)} style={{ color: "var(--ink)", fontWeight: 600 }}>{p.full_name}</Link> <span className="muted" style={{ fontSize: 13 }}>{p.pts}/{p.reb}/{p.ast}</span></span>
                    <span className="mono">{fmt.n1(p.game_score)}</span>
                  </div>
                ))}
              </div>
              {star ? (
                <div style={{ padding: "16px 18px", borderRadius: 18, background: "rgba(107,63,212,.16)", border: "1px solid rgba(154,114,245,.3)" }}>
                  <span className="k gold" style={{ display: "block", fontSize: 11, marginBottom: 4 }}>Stat of the night</span>
                  {star.full_name} carried <span className="mono gold">{fmt.pct(star.usg_pct)}</span> of possessions and still hit <span className="mono gold">{fmt.pct(star.ts_pct)}</span> true shooting.
                </div>
              ) : null}
            </article>
          ) : null}

          {trend.length ? (
            <article className="glass lift rise" style={{ animationDelay: ".12s", display: "flex", flexDirection: "column", gap: 18, padding: 30, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="k muted">Trend report</span><span className="k gold">Last 5 vs season</span></div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 34, lineHeight: 1, letterSpacing: "-.035em" }}>The <span className="se" style={{ fontSize: 40 }}>401</span> Report</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>True-shooting change over the last five games. Who's in the express lane, who's stuck in the collectors.</p>
              <TrendList title="Express lane" up rows={risers} max={maxDelta} />
              <TrendList title="Collectors" rows={fallers} max={maxDelta} />
            </article>
          ) : null}

          {lineups.length ? (
            <article className="glass lift rise" style={{ animationDelay: ".24s", display: "flex", flexDirection: "column", gap: 18, padding: 30, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="k muted">Best 3-man units</span><span className="k gold">Min. 60 minutes</span></div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 34, lineHeight: 1, letterSpacing: "-.035em" }}>Lineup <span className="se" style={{ fontSize: 40 }}>Lab</span></h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>Which trios actually win their minutes this season, per 100 possessions.</p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="k muted" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px 76px", gap: 10, padding: 8, fontSize: 11, borderBottom: "1px solid rgba(243,238,230,.14)" }}><span>Unit</span><span style={{ textAlign: "right" }}>Min</span><span className="gold" style={{ textAlign: "right" }}>Net</span></div>
                {lineups.map((u: any) => (
                  <div key={u.group_id} className="row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px 76px", gap: 10, alignItems: "center", padding: "15px 8px", borderTop: "1px solid rgba(243,238,230,.07)" }}>
                    <span style={{ fontSize: 15 }}>{u.name}</span>
                    <span className="mono" style={{ textAlign: "right" }}>{Math.round(u.minutes)}</span>
                    <span className="mono gold" style={{ textAlign: "right" }}>{fmt.signed(u.net_rtg)}</span>
                  </div>
                ))}
              </div>
              <Link className="btn btn-o" href="/stats-lab?tab=lineups#explorer" style={{ marginTop: "auto" }}>Explore every lineup →</Link>
            </article>
          ) : null}
        </div>
      </section>

      <section id="archives" className="wrap sec">
        <div className="sechead">
          <div><div className="k gold" style={{ marginBottom: 12 }}>02 — Every season since 1995</div><h2 className="h2">From the ACC <span className="se" style={{ fontSize: "1.1em" }}>Archives</span></h2></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: 24 }}>
          {otd ? (
            <article className="glass lift" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, minHeight: 440, padding: 36, background: "linear-gradient(140deg, #3A1E8C, #1A1230 55%, #0E0C12)", minWidth: 0 }}>
              <div aria-hidden="true" className="se" style={{ position: "absolute", right: 18, top: -24, fontSize: "clamp(150px, 20vw, 260px)", lineHeight: 1, color: "rgba(243,238,230,.1)" }}>&apos;{String(otd.game_date).slice(2, 4)}</div>
              <span className="k" style={{ position: "relative", alignSelf: "flex-start", padding: "6px 14px", borderRadius: 999, background: "var(--gold)", color: "var(--bg)", fontWeight: 700 }}>On this day</span>
              <span className="k soft" style={{ position: "relative", fontSize: 13 }}>{longDate(otd.game_date)}{otd.season_type === "Playoffs" ? " · Playoffs" : ""}</span>
              <h3 style={{ position: "relative", margin: 0, fontWeight: 700, fontSize: "clamp(26px, 3vw, 38px)", lineHeight: 1.08, letterSpacing: "-.03em", maxWidth: "15em" }}>
                Raptors {otd.wl === "W" ? "beat" : "fell to"} the {teamName(otd.opponent_abbr)} {otd.team_pts}–{otd.opp_pts}
                {otd.is_home ? " at home" : " on the road"}
              </h3>
              {otd.top_name ? <p className="soft" style={{ position: "relative", margin: 0, maxWidth: "34em" }}>{otd.top_name} led the way with {otd.top_pts} points.</p> : null}
            </article>
          ) : null}
          <article className="glass lift" style={{ display: "flex", flexDirection: "column", gap: 4, padding: 30, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 30, letterSpacing: "-.03em" }}>Record <span className="se" style={{ fontSize: 34 }}>Book</span></h3>
              <span className="k muted">Franchise leaders</span>
            </div>
            {bookRows.map((b) => (
              <div key={b.category} className="row" style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "16px 8px", borderTop: "1px solid rgba(243,238,230,.1)" }}>
                <span className="k gold">{b.label}</span><span>{b.name}</span><span className="mono">{fmt.int(b.value)}</span>
              </div>
            ))}
            <Link href="/stats-lab?tab=leaders#explorer" style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600 }}>Full record book →</Link>
          </article>
        </div>
      </section>

      {news.length || feed.length ? (
        <section id="news" className="wrap sec">
          <div className="sechead" style={{ marginBottom: 24 }}>
            <div>
              <div className="k gold" style={{ marginBottom: 12 }}>03 — The wire</div>
              <h2 className="h2">Raptors Twitter, <span className="se" style={{ fontSize: "1.1em" }}>today</span></h2>
            </div>
            <Link href="/feed" className="btn btn-o" style={{ minHeight: 48, padding: "0 22px" }}>Open the full feed →</Link>
          </div>
          <div className="wire">
            <div className="wire-posts">
              {feed.map((p) => <PostCard key={p.id} p={p} compact />)}
            </div>
            {news.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="k muted" style={{ marginBottom: 6 }}>Headlines</span>
                {news.map((h, i) => (
                  <a key={h.url} className="row" href={h.url} rel="noopener" target="_blank" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "18px 8px", borderTop: "1px solid rgba(243,238,230,.12)", borderBottom: i === news.length - 1 ? "1px solid rgba(243,238,230,.12)" : undefined, textDecoration: "none", color: "var(--ink)" }}>
                    <span className="k gold" style={{ fontSize: 11 }}>{h.source} · <span className="muted">{timeAgo(h.published)}</span></span>
                    <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-.015em", lineHeight: 1.25 }}>{h.title}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section id="grades" className="wrap sec">
        <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap", padding: "clamp(32px, 5.5vw, 76px)", borderRadius: 40, background: "linear-gradient(125deg, #4A2AA8, #24154F 50%, #100D18)", border: "1px solid rgba(217,184,120,.3)" }}>
          <div aria-hidden="true" className="drift2" style={{ position: "absolute", right: -120, top: -200, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,184,120,.28), rgba(217,184,120,0) 65%)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16, minWidth: 0, flex: "1 1 520px" }}>
            <span className="k gold">Jurassic Park Grades{grades ? ` · ${grades.game.is_home ? "vs" : "at"} ${teamName(grades.game.opponent_abbr)}` : ""}</span>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: "clamp(38px, 5.6vw, 80px)", lineHeight: 0.95, letterSpacing: "-.045em" }}>Grade the squad.<br /><span className="se" style={{ fontSize: "1.02em" }}>Then argue with the numbers.</span></h2>
            <p style={{ margin: 0, color: "#E2DCD2", maxWidth: "36em", fontSize: 17 }}>Hand out a grade to every Raptor after the buzzer. The Lab grades them too, straight from Game Score and plus-minus. We post where fans and the numbers disagree.</p>
            {grades ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 460 }}>
                {[...grades.rows].filter((r: any) => r.lab !== "INC").sort((x: any, y: any) => Number(y.lab_score) - Number(x.lab_score)).slice(0, 3).map((r: any) => (
                  <div key={r.player_id} className="row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 6px" }}>
                    <Link className="ul" href={playerHref(r.full_name)} style={{ flex: 1, color: "var(--ink)", fontWeight: 600 }}>{r.full_name}</Link>
                    <GradeBadge g={r.lab} kind="lab" size={40} />
                    <GradeBadge g={r.fan} kind="fan" size={40} />
                  </div>
                ))}
              </div>
            ) : null}
            <Link className="btn btn-g" href="/grades" style={{ alignSelf: "flex-start", marginTop: 8 }}>{grades && grades.voters ? `Join ${grades.voters} fans grading →` : "Grade the last game →"}</Link>
          </div>
          <div aria-hidden="true" style={{ position: "relative", display: "flex", gap: 10, fontWeight: 800, fontSize: 36 }}>
            {["A", "B", "C", "D", "F"].map((g, i) => <span key={g} className="tile" style={{ animationDelay: `${i * 1.2}s` }}>{g}</span>)}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function TrendList({ title, rows, max, up = false }: { title: string; rows: any[]; max: number; up?: boolean }) {
  if (!rows.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: up ? 0 : 16, borderTop: up ? "none" : "1px solid rgba(243,238,230,.12)" }}>
      <span className="k" style={{ display: "flex", alignItems: "center", gap: 8, color: up ? "var(--gold)" : "#B9A4F0", fontWeight: 700 }}>
        <svg aria-hidden="true" viewBox="0 0 16 16" style={{ width: 14, height: 14 }}><path d={up ? "M8 14V2M3 7l5-5 5 5" : "M8 2v12M3 9l5 5 5-5"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {title}
      </span>
      {rows.map((r) => (
        <div key={r.full_name} className="row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,.8fr) auto", gap: 12, alignItems: "center", padding: 8 }}>
          <span><Link className="ul" href={playerHref(r.full_name)} style={{ color: "var(--ink)", fontWeight: 600 }}>{r.full_name}</Link> <span className="muted" style={{ fontSize: 13 }}>{fmt.n1(r.ts_last5)}% TS</span></span>
          <span className="track"><span className="bar" style={{ width: `${Math.max(8, (Math.abs(Number(r.ts_delta)) / max) * 100)}%`, background: up ? undefined : "var(--purple)" }} /></span>
          <span className="mono" style={{ color: up ? "var(--gold)" : "#B9A4F0" }}>{fmt.signed(r.ts_delta)}</span>
        </div>
      ))}
    </div>
  );
}

function Skyline() {
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 240 }}>
      <defs><linearGradient id="skH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A2378" stopOpacity=".85" /><stop offset="1" stopColor="#0A090C" stopOpacity=".2" /></linearGradient></defs>
      <g fill="url(#skH)">
        {[[0,170,70],[78,138,46],[132,158,62],[204,118,40],[252,150,58],[320,174,76],[406,132,44],[460,160,60],[530,108,42],[582,146,56],[648,170,70],[728,126,46],[784,154,52],[1030,140,50],[1090,112,44],[1144,162,66],[1220,130,48],[1278,156,60],[1348,122,42],[1398,166,42]].map(([x, y, w]) => (
          <rect key={x} x={x} y={y} width={w} height={240 - y} rx="3" />
        ))}
        <path d="M850,240 Q902,186 954,240 Z" />
        <path d="M989,12 L991,12 L993,96 Q1004,98 1008,108 L1003,122 L995,124 L1002,240 L978,240 L985,124 L977,122 L972,108 Q976,98 987,96 Z" />
      </g>
      <circle cx="990" cy="12" r="3" fill="#E5484D" />
    </svg>
  );
}
