/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Header, Footer, X_URL } from "@/components/Chrome";
import GradeBoard from "@/components/GradeBoard";
import { teamName } from "@/lib/teams";

const day = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export default function GradesView({ g, history, latestId, jerseys = {} }: { g: any; history: any[]; latestId: string; jerseys?: Record<string, string> }) {
  const game = g.game;
  const open = game.game_id === latestId;
  const shareText = `Grading the Raptors ${game.is_home ? "vs" : "at"} ${teamName(game.opponent_abbr)} on @PurpleDinosTO 🦖 What did you give them?`;
  const shareUrl = `https://purpledinos.ca/grades/${game.game_id}`;
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="grades" />
      <main className="wrap" style={{ paddingTop: 64 }}>
        <div className="k gold rise" style={{ marginBottom: 14 }}>Jurassic Park Grades · {open ? "Voting open" : "Final grades"}</div>
        <h1 className="rise" style={{ margin: 0, fontWeight: 800, fontSize: "clamp(42px,6vw,84px)", lineHeight: 0.95, letterSpacing: "-.045em" }}>
          Raptors {game.team_pts}–{game.opp_pts} <span className="se" style={{ fontSize: "1.02em" }}>{game.is_home ? "vs" : "at"} {teamName(game.opponent_abbr)}</span>
        </h1>
        <p className="soft" style={{ maxWidth: "44em", fontSize: 17, margin: "16px 0 8px" }}>
          {day(game.game_date)} · {game.wl === "W" ? "Win" : "Loss"}. The <b style={{ color: "#B9A4F0" }}>Lab grade</b> is pure numbers: Game Score, nudged by plus-minus, with anyone under 8 minutes marked incomplete. The <b className="gold">Fan consensus</b> is every fan&apos;s grade averaged together. Grade every guy, then see where you and the numbers disagree.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0 36px" }}>
          <a className="btn btn-g" href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}>Share your grades on X</a>
          <a className="btn btn-o" href={X_URL}>Follow @PurpleDinosTO</a>
        </div>
        <div className="glass" style={{ padding: "18px 22px", marginBottom: 28, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderColor: open ? "rgba(217,184,120,.5)" : undefined }}>
          {open ? (
            <>
              <span className="gb gb-fan" style={{ width: 44, height: 36, fontSize: 18 }}>B+</span>
              <p style={{ margin: 0, flex: "1 1 280px", fontSize: 16 }}><b>Voting is open.</b> Tap a grade in the <b className="gold">Your grade</b> row under each player. You can change it until the next game. Your grade averages into the <b className="gold">Fan consensus</b> next to the Lab&apos;s.</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, flex: "1 1 280px", fontSize: 16 }}><b>Voting for this game is closed.</b> Grading is open for the most recent game.</p>
              <Link className="btn btn-g" href="/grades">Grade the latest game →</Link>
            </>
          )}
        </div>
        <div className="grades-layout">
          <div style={{ minWidth: 0 }}>
            <GradeBoard gameId={game.game_id} rows={g.rows} open={open} jerseys={jerseys} />
          </div>
          <aside className="glass" style={{ padding: 24 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 800 }}>Past report cards</h2>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {history.map((h) => (
                <Link key={h.game_id} href={`/grades/${h.game_id}`} className={`row hist${h.game_id === game.game_id ? " on" : ""}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 10px", textDecoration: "none", color: "var(--ink)" }}>
                  <span><b style={{ color: h.wl === "W" ? "var(--gold)" : "#B9A4F0" }}>{h.wl}</b> {h.is_home ? "vs" : "@"} {h.opponent_abbr} <span className="muted mono" style={{ fontSize: 13 }}>{h.team_pts}–{h.opp_pts}</span></span>
                  <span className="muted mono" style={{ fontSize: 12 }}>{Number(h.voters) ? `${h.voters} graded` : day(h.game_date).replace(/, \d{4}$/, "")}</span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
