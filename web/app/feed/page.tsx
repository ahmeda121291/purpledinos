import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import FeedView from "@/components/FeedView";
import type { FeedPost } from "@/components/PostCard";
import { db } from "@/lib/supabase";

export const revalidate = 120;
export const metadata: Metadata = {
  title: "Raptors Twitter, curated · The Feed · Purple Dinos",
  description: "The best Toronto Raptors writers, podcasters and film nerds on X, in one feed. Original posts only, refreshed every 10 minutes.",
  alternates: { canonical: "/feed" },
};

export default async function Feed() {
  const { data } = await db.from("v_feed").select("*").eq("raptors", true).order("created_at", { ascending: false }).limit(400);
  const posts = (data as FeedPost[]) ?? [];
  const voices = new Set(posts.map((p) => p.handle)).size;
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="feed" />
      <main className="wrap" style={{ paddingTop: 64, position: "relative" }}>
        <div aria-hidden="true" className="drift" style={{ position: "absolute", left: -220, top: -180, width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,63,212,.32), rgba(107,63,212,0) 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div className="k gold rise" style={{ marginBottom: 12 }}>The feed · {voices || 19} voices · updated every 10 min</div>
          <h1 className="rise" style={{ margin: 0, fontWeight: 800, fontSize: "clamp(46px,7vw,100px)", lineHeight: 0.92, letterSpacing: "-.05em" }}>
            Raptors Twitter, <span className="se" style={{ fontSize: "1.04em" }}>minus the noise</span>
          </h1>
          <p className="soft rise" style={{ margin: "22px 0 0", maxWidth: "38em", fontSize: 18 }}>
            Beat writers, podcasters and film-room nerds worth following. Original posts only: no replies, no reposts, no rage bait.
          </p>
        </div>
        <section style={{ paddingTop: 48, position: "relative" }}>
          <FeedView posts={posts} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
