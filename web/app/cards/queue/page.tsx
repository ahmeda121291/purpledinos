/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { LogoMark } from "@/components/Logo";
import { admin } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Post queue · Purple Dinos", robots: { index: false, follow: false } };

const STATUS_COLOR: Record<string, string> = { preview: "#D9B878", posted: "#7BD88F", failed: "#E5484D", queued: "#B9A4F0" };

export default async function Queue() {
  const db = admin();
  const [{ data: posts }, { data: mode }, { data: runs }] = await Promise.all([
    db.from("x_posts").select("*").order("created_at", { ascending: false }).limit(40),
    db.from("app_settings").select("value").eq("key", "posting_mode").maybeSingle(),
    db.from("job_runs").select("job, status, started_at, detail").eq("job", "poster").order("started_at", { ascending: false }).limit(1),
  ]);
  const last = runs?.[0];
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="home" />
      <main className="wrap" style={{ paddingTop: 64, maxWidth: 760 }}>
        <div className="k gold" style={{ marginBottom: 12 }}>Mode: {mode?.value === "live" ? "LIVE — posting to X" : "PREVIEW — nothing goes to X"}</div>
        <h1 className="h2" style={{ marginBottom: 12 }}>Post <span className="se" style={{ fontSize: "1.1em" }}>queue</span></h1>
        <p className="soft" style={{ margin: "0 0 12px" }}>Every post the engine has made, newest first. It checks every 15 minutes and makes at most one post per check.</p>
        {last ? <p className="k muted" style={{ margin: "0 0 40px", fontSize: 11 }}>Last check: {new Date(last.started_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })} · {last.detail || "nothing due"}</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {(posts ?? []).length === 0 ? <p className="soft">Nothing yet. The first post lands when something is due (Game Day at 10 AM on game days, On This Day at noon).</p> : null}
          {(posts ?? []).map((p: any) => (
            <article key={p.id} style={{ background: "#000", border: "1px solid #2F3336", borderRadius: 16, padding: 16, display: "flex", gap: 12, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
              <LogoMark size={40} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 15, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span><strong style={{ color: "#E7E9EA" }}>Purple Dinos</strong> <span style={{ color: "#71767B" }}>@PurpleDinosTO · {new Date(p.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>
                  <span className="k" style={{ color: STATUS_COLOR[p.status] ?? "#A8A29A", fontSize: 11 }}>{p.status}{p.x_post_id ? ` · ${p.x_post_id}` : ""}</span>
                </div>
                <p style={{ margin: 0, color: "#E7E9EA", fontSize: 15, lineHeight: 1.4 }}>{p.caption}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={`${p.post_type} card`} width={1200} height={675} style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid #2F3336", marginTop: 6 }} />
                {p.error ? <p style={{ margin: 0, color: "#E5484D", fontSize: 13 }}>{p.error}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
