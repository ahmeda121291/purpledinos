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
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [{ data: posts }, { data: mode }, { data: runs }, { data: health }, { data: spendRows }, { data: cap }] = await Promise.all([
    db.from("x_posts").select("*").order("created_at", { ascending: false }).limit(40),
    db.from("app_settings").select("value").eq("key", "posting_mode").maybeSingle(),
    db.from("job_runs").select("job, status, started_at, detail").eq("job", "poster").order("started_at", { ascending: false }).limit(1),
    db.from("job_runs").select("job, status, started_at, detail").gte("started_at", new Date(Date.now() - 2 * 86400000).toISOString()).order("started_at", { ascending: false }).limit(300),
    db.from("x_posts").select("cost").gte("posted_at", monthStart.toISOString()),
    db.from("app_settings").select("value").eq("key", "x_budget_month").maybeSingle(),
  ]);
  const spent = ((spendRows as any[]) ?? []).reduce((a, r) => a + Number(r.cost ?? 0), 0);
  const h = (health as any[]) ?? [];
  const lastOk = (job: string) => h.find((r) => r.job === job && r.status === "ok")?.started_at as string | undefined;
  const errors = h.filter((r) => r.status !== "ok" && r.status !== "running" && Date.now() - Date.parse(r.started_at) < 86400000);
  const failedPosts = ((posts as any[]) ?? []).filter((p) => p.status === "failed");
  const ago = (iso?: string) => (iso ? `${Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 3600000))}h ago` : "never");
  const checks = [
    { name: "Nightly data", ok: Boolean(lastOk("nightly")) && Date.now() - Date.parse(lastOk("nightly")!) < 30 * 3600000, note: `last success ${ago(lastOk("nightly"))}` },
    { name: "Poster", ok: Boolean(lastOk("poster")) && Date.now() - Date.parse(lastOk("poster")!) < 3600000, note: `last success ${ago(lastOk("poster"))}` },
    { name: "Errors (24h)", ok: errors.length === 0, note: errors.length ? `${errors.length}: ${String(errors[0].detail ?? "").slice(0, 80)}` : "none" },
    { name: "Failed posts", ok: failedPosts.length === 0, note: failedPosts.length ? `${failedPosts.length} (retried up to 3 times)` : "none" },
    { name: "X spend this month", ok: spent < Number(cap?.value ?? 20) * 0.8, note: `$${spent.toFixed(2)} of $${Number(cap?.value ?? 20).toFixed(0)} budget` },
  ];
  const last = runs?.[0];
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="none" />
      <main className="wrap" style={{ paddingTop: 64, maxWidth: 760 }}>
        <div className="k gold" style={{ marginBottom: 12 }}>Mode: {mode?.value === "live" ? "LIVE — posting to X" : "PREVIEW — nothing goes to X"}</div>
        <h1 className="h2" style={{ marginBottom: 12 }}>Post <span className="se" style={{ fontSize: "1.1em" }}>queue</span></h1>
        <p className="soft" style={{ margin: "0 0 12px" }}>Every post the engine has made, newest first. It checks every 15 minutes and makes at most one post per check.</p>
        {last ? <p className="k muted" style={{ margin: "0 0 40px", fontSize: 11 }}>Last check: {new Date(last.started_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })} · {last.detail || "nothing due"}</p> : null}
        <div className="glass" style={{ padding: "18px 20px", marginBottom: 36, display: "grid", gap: 10 }}>
          <div className="k muted" style={{ fontSize: 11 }}>Health · self-heals hourly</div>
          {checks.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
              <span className="dot" style={{ background: c.ok ? "#7BD88F" : "#E5484D" }} />
              <b>{c.name}</b><span className="muted" style={{ fontSize: 13 }}>{c.note}</span>
            </div>
          ))}
        </div>
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
                {p.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image_url} alt={`${p.post_type} card`} width={1200} height={675} style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid #2F3336", marginTop: 6 }} />
                ) : null}
                {p.payload?.poll ? (
                  <div style={{ marginTop: 8, padding: 12, borderRadius: 14, border: "1px solid #2F3336" }}>
                    {p.image_url && p.payload.pollText ? <p style={{ margin: "0 0 8px", color: "#71767B", fontSize: 13 }}>↳ Reply: {p.payload.pollText}</p> : null}
                    {p.payload.poll.options.map((o: string) => <div key={o} style={{ padding: "8px 12px", margin: "4px 0", borderRadius: 999, border: "1px solid #1D9BF0", color: "#1D9BF0", fontSize: 14, fontWeight: 700 }}>{o}</div>)}
                    <p style={{ margin: "6px 0 0", color: "#71767B", fontSize: 12 }}>Poll · {Math.round(p.payload.poll.minutes / 60)}h</p>
                  </div>
                ) : null}
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
