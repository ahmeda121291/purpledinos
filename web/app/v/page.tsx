/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { Header, Footer, X_URL } from "@/components/Chrome";
import { ShareActions } from "@/components/ChartStudio";
import { getViz } from "@/lib/viz";

type SP = Promise<Record<string, string | string[] | undefined>>;
const toQs = (sp: Record<string, any>) => new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && !k.startsWith("utm_")) as [string, string][]).toString();

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const qs = toQs(await searchParams);
  const v = await getViz(new URLSearchParams(qs)).catch(() => null);
  const title = v ? `${v.title} · Purple Dinos Stats Lab` : "Purple Dinos Stats Lab";
  const description = v?.ctx ? `${v.ctx}. Make your own Raptors charts at purpledinos.ca.` : "Make your own Raptors charts at purpledinos.ca.";
  const img = `/api/viz?${qs}`;
  return { title, description, robots: { index: false, follow: true }, openGraph: { title, description, images: [{ url: img, width: 1200, height: 675 }] }, twitter: { card: "summary_large_image", title, description, images: [img] } };
}

export default async function Viz({ searchParams }: { searchParams: SP }) {
  const qs = toQs(await searchParams);
  const q = new URLSearchParams(qs);
  const kind = q.get("kind") || "bar";
  const lab = new URLSearchParams(qs);
  if (kind === "table") lab.delete("kind"); else lab.set("tab", "chart");
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="lab" />
      <main className="wrap" style={{ paddingTop: 56, maxWidth: 1040 }}>
        <div className="k gold" style={{ marginBottom: 16 }}>Made in the Stats Lab</div>
        <div className="glass" style={{ padding: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/viz?${qs}`} alt="Raptors chart from the Purple Dinos Stats Lab" width={1200} height={675} style={{ width: "100%", height: "auto", display: "block", borderRadius: 20 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 20 }}>
          <ShareActions qs={qs} label={kind === "table" ? "table" : "chart"} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-o sm" href={`/stats-lab?${lab.toString()}#explorer`}>Tweak it in the Stats Lab →</Link>
            <a className="btn btn-o sm" href={X_URL}>Follow @PurpleDinosTO</a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
