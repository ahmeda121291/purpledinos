"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import PostCard, { FeedPost, isTrending } from "./PostCard";

type Tab = "latest" | "trending" | "media";

export default function FeedView({ posts }: { posts: FeedPost[] }) {
  const [tab, setTab] = useState<Tab>("latest");
  const [who, setWho] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const voices = useMemo(() => {
    const m = new Map<string, { handle: string; name: string; avatar: string | null; count: number }>();
    for (const p of posts.filter((x) => all || x.raptors)) {
      const v = m.get(p.handle) ?? { handle: p.handle, name: p.name, avatar: p.avatar_url, count: 0 };
      v.count++; m.set(p.handle, v);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [posts, all]);

  const shown = useMemo(() => {
    let r = posts.filter((p) => (!who || p.handle === who) && (all || p.raptors));
    if (tab === "media") r = r.filter((p) => p.media?.length);
    if (tab === "trending") r = [...r].filter((p) => Date.now() - Date.parse(p.created_at) < 48 * 3600000).sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 40);
    return r.slice(0, 120);
  }, [posts, tab, who, all]);

  const hot = posts.filter((p) => isTrending(p) && (all || p.raptors)).length;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div className="tabs" role="tablist" aria-label="Sort the feed">
          {([["latest", "Latest"], ["trending", `Trending${hot ? ` · ${hot}` : ""}`], ["media", "Photos & video"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="tabs" role="group" aria-label="What to show">
          <button className={`tab ${!all ? "on" : ""}`} aria-pressed={!all} onClick={() => setAll(false)}>Raptors talk</button>
          <button className={`tab ${all ? "on" : ""}`} aria-pressed={all} onClick={() => setAll(true)}>Everything</button>
        </div>
      </div>

      <div role="group" aria-label="Filter by writer" className="voices" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "4px 2px 14px", marginBottom: 18, scrollbarWidth: "thin" }}>
        <button className={`voice ${who === null ? "on" : ""}`} aria-pressed={who === null} onClick={() => setWho(null)}>
          <span className="voice-av" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>All</span>
          <span className="voice-n">Everyone</span>
        </button>
        {voices.map((v) => (
          <button key={v.handle} className={`voice ${who === v.handle ? "on" : ""}`} aria-pressed={who === v.handle} onClick={() => setWho(who === v.handle ? null : v.handle)} title={`@${v.handle}`}>
            {v.avatar ? <img className="voice-av" src={v.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="voice-av" />}
            <span className="voice-n">{v.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="feedcols">
          {shown.map((p) => <PostCard key={p.id} p={p} />)}
        </div>
      ) : (
        <p className="muted" style={{ padding: "48px 0", fontSize: 18 }}>Nothing here yet. The feed checks for new posts every 10 minutes.</p>
      )}
    </>
  );
}
