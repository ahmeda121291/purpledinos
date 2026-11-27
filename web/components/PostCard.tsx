/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
// One post from Raptors Twitter, styled for the site. Works in server and client components.

export type FeedPost = {
  id: string; text: string; created_at: string; metrics: any; media: any[]; urls: any[]; quoted_id: string | null;
  raptors: boolean; score: number; reposted_at: string | null; handle: string; name: string; avatar_url: string | null; verified: boolean;
};

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};
const n = (v: any) => {
  const x = Number(v ?? 0);
  return x >= 10000 ? `${Math.round(x / 1000)}K` : x >= 1000 ? `${(x / 1000).toFixed(1)}K` : String(x);
};
export const isTrending = (p: FeedPost) => Number(p.score) >= 2 && Date.now() - Date.parse(p.created_at) < 24 * 3600000;

function Rich({ text, urls }: { text: string; urls: any[] }) {
  const byDisplay = new Map((urls ?? []).map((u: any) => [u.display, u.url]));
  const parts = text.split(/(@\w{1,15}|#\w+|https?:\/\/\S+|\b[\w-]+(?:\.[\w-]+)+\/\S*…?)/g);
  return (
    <>
      {parts.map((t, i) => {
        if (!t) return null;
        if (t.startsWith("@")) return <a key={i} href={`https://x.com/${t.slice(1)}`} target="_blank" rel="noopener" className="pc-l">{t}</a>;
        if (t.startsWith("#")) return <a key={i} href={`https://x.com/hashtag/${t.slice(1)}`} target="_blank" rel="noopener" className="pc-l">{t}</a>;
        const href = byDisplay.get(t) ?? (t.startsWith("http") ? t : null);
        if (href) return <a key={i} href={href} target="_blank" rel="noopener" className="pc-l">{t.replace(/^https?:\/\//, "")}</a>;
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z";
const REPOST = "M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4";
const REPLY = "M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 21 11.5Z";

export function XLogo({ size = 14 }: { size?: number }) {
  return (
    <svg role="img" aria-label="X" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.2h1.7L7.4 4.7H5.58l11.09 14.5Z" />
    </svg>
  );
}

function Media({ media, href }: { media: any[]; href: string }) {
  const m = media.slice(0, 4);
  if (!m.length) return null;
  const one = m.length === 1;
  return (
    <div className="pc-media" style={{ display: "grid", gridTemplateColumns: one ? "1fr" : "1fr 1fr", gap: 4, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(243,238,230,.1)" }}>
      {m.map((x, i) => {
        const ratio = one && x.w && x.h ? `${x.w} / ${Math.min(x.h, x.w * 1.25)}` : "1 / 1";
        const img = <img src={x.url} alt={x.alt ?? "Image from the post"} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", display: "block", background: "#17141E" }} />;
        if (x.type === "photo") return <div key={i} style={{ gridColumn: m.length === 3 && i === 0 ? "span 2" : undefined }}>{img}</div>;
        return (
          <a key={i} href={href} target="_blank" rel="noopener" aria-label="Play video on X" style={{ position: "relative", display: "block" }}>
            {img}
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 62, height: 62, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,9,12,.72)", border: "1px solid rgba(217,184,120,.6)", backdropFilter: "blur(6px)" }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="#D9B878"><path d="M8 5.5v13l11-6.5-11-6.5Z" /></svg>
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

export default function PostCard({ p, compact = false }: { p: FeedPost; compact?: boolean }) {
  const href = `https://x.com/${p.handle}/status/${p.id}`;
  const hot = isTrending(p);
  const link = !p.media?.length ? (p.urls ?? []).find((u: any) => u.title) : null;
  return (
    <article className="glass pc" style={{ padding: compact ? 18 : 22, borderRadius: 24, display: "flex", flexDirection: "column", gap: 14, breakInside: "avoid", marginBottom: compact ? 0 : 18, ...(hot ? { borderColor: "rgba(217,184,120,.42)" } : {}) }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <a href={`https://x.com/${p.handle}`} target="_blank" rel="noopener" style={{ flex: "none", borderRadius: "50%", padding: 2, background: hot ? "linear-gradient(135deg,#D9B878,#6B3FD4)" : "rgba(243,238,230,.14)" }} aria-label={`${p.name} on X`}>
          {p.avatar_url ? <img src={p.avatar_url} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" style={{ display: "block", width: 44, height: 44, borderRadius: "50%", objectFit: "cover", background: "#17141E" }} /> : <span style={{ display: "block", width: 44, height: 44, borderRadius: "50%", background: "#2A2236" }} />}
        </a>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
          <a href={`https://x.com/${p.handle}`} target="_blank" rel="noopener" style={{ display: "block", color: "var(--ink)", textDecoration: "none", fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</a>
          <span className="mono muted" style={{ fontSize: 13 }}>@{p.handle} · <time dateTime={p.created_at} suppressHydrationWarning>{ago(p.created_at)}</time></span>
        </div>
        {hot ? <span className="k" style={{ flex: "none", padding: "5px 10px", borderRadius: 999, background: "rgba(217,184,120,.14)", color: "var(--gold)", fontSize: 10 }}>Trending</span> : null}
      </header>

      {p.text ? (
        <p style={{ margin: 0, fontSize: compact ? 15.5 : 16.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...(compact ? { display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" as any, overflow: "hidden" } : {}) }}>
          <Rich text={p.text} urls={p.urls} />
        </p>
      ) : null}

      <Media media={p.media ?? []} href={href} />

      {link ? (
        <a href={link.url} target="_blank" rel="noopener" className="row" style={{ display: "flex", gap: 14, alignItems: "center", padding: 10, borderRadius: 16, border: "1px solid rgba(243,238,230,.12)", textDecoration: "none", color: "var(--ink)" }}>
          {link.image ? <img src={link.image} alt="" width={84} height={84} loading="lazy" referrerPolicy="no-referrer" style={{ flex: "none", width: 84, height: 84, borderRadius: 12, objectFit: "cover" }} /> : null}
          <span style={{ minWidth: 0 }}>
            <span className="k muted" style={{ fontSize: 10, display: "block" }}>{String(link.display ?? "").split("/")[0]}</span>
            <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{link.title}</span>
          </span>
        </a>
      ) : null}

      {p.quoted_id ? (
        <a href={`https://x.com/i/status/${p.quoted_id}`} target="_blank" rel="noopener" className="k" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>↳ Quoting a post · view on X</a>
      ) : null}

      <footer style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 2, color: "var(--muted)", fontSize: 13 }} className="mono">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label={`${p.metrics?.reply_count ?? 0} replies`}><Icon d={REPLY} />{n(p.metrics?.reply_count)}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label={`${p.metrics?.retweet_count ?? 0} reposts`}><Icon d={REPOST} />{n(p.metrics?.retweet_count)}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label={`${p.metrics?.like_count ?? 0} likes`}><Icon d={HEART} />{n(p.metrics?.like_count)}</span>
        <a href={href} target="_blank" rel="noopener" className="pc-x" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, color: "var(--soft)", textDecoration: "none" }}>
          {p.reposted_at ? <span className="gold" style={{ fontSize: 11 }}>Reposted by us ·</span> : null}
          <XLogo /> <span style={{ fontSize: 12 }}>View</span>
        </a>
      </footer>
    </article>
  );
}
