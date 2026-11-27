import Link from "next/link";
import { LogoMark, Wordmark } from "./Logo";

export const X_URL = "https://x.com/PurpleDinosTO";

export function Header({ active }: { active: "home" | "lab" | "players" | "grades" | "none" }) {
  return (
    <header className="hdr">
      <div className="wrap" style={{ paddingTop: 12, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px 24px", flexWrap: "wrap" }}>
        <Link href="/" className="brand" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, textDecoration: "none", color: "var(--ink)" }} aria-label="Purple Dinos home">
          <LogoMark />
          <Wordmark />
        </Link>
        <nav aria-label="Main" style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", fontSize: 15, fontWeight: 500 }}>
          <Link className={`nl ${active === "home" ? "on" : ""}`} aria-current={active === "home" ? "page" : undefined} href="/">Tonight</Link>
          <Link className={`nl ${active === "lab" ? "on" : ""}`} aria-current={active === "lab" ? "page" : undefined} href="/stats-lab">Stats Lab</Link>
          <Link className={`nl ${active === "players" ? "on" : ""}`} aria-current={active === "players" ? "page" : undefined} href="/players">Players</Link>
          <Link className={`nl ${active === "grades" ? "on" : ""}`} aria-current={active === "grades" ? "page" : undefined} href="/grades">Grades</Link>
          <Link className="nl" href="/#archives">Archives</Link>
        </nav>
        <a className="btn btn-o" href={X_URL} style={{ minHeight: 44, padding: "0 20px", fontSize: 14 }}>Follow @PurpleDinosTO</a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ marginTop: 104, borderTop: "1px solid rgba(243,238,230,.1)" }}>
      <div className="wrap" style={{ paddingTop: 44, paddingBottom: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Wordmark size={30} />
          <span className="k muted">Made in the 6ix <span className="gold">·</span> Here since the purple days</span>
        </div>
        <nav aria-label="Footer" style={{ display: "flex", gap: "4px 8px", flexWrap: "wrap", fontWeight: 500 }}>
          <Link className="nl" href="/stats-lab">Stats Lab</Link>
          <Link className="nl" href="/players">Players</Link>
          <Link className="nl" href="/grades">Grades</Link>
          <Link className="nl" href="/#archives">Archives</Link>
          <Link className="nl" href="/#news">News</Link>
          <a className="nl" href={X_URL} style={{ color: "var(--gold)" }}>@PurpleDinosTO</a>
        </nav>
      </div>
    </footer>
  );
}
