import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/Chrome";
import { CARD_META, CARD_TYPES, CardType, getCard, intentUrl } from "@/lib/cards";

export const revalidate = 600;

type P = { params: Promise<{ type: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { type } = await params;
  if (!(CARD_TYPES as readonly string[]).includes(type)) return {};
  const t = type as CardType;
  const card = await getCard(t).catch(() => null);
  const title = `${CARD_META[t].name} · Purple Dinos`;
  const description = card?.caption ?? "Raptors basketball from the 6ix.";
  const image = { url: `/api/card/${t}`, width: 1200, height: 675, alt: `${CARD_META[t].name} card from Purple Dinos` };
  return {
    title, description,
    openGraph: { title, description, images: [image], url: `/c/${t}`, siteName: "Purple Dinos" },
    twitter: { card: "summary_large_image", site: "@PurpleDinosTO", title, description, images: [image.url] },
  };
}

export default async function CardPage({ params }: P) {
  const { type } = await params;
  if (!(CARD_TYPES as readonly string[]).includes(type)) notFound();
  const t = type as CardType;
  const card = await getCard(t).catch(() => null);
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="none" />
      <main className="wrap" style={{ paddingTop: 64, display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
        <span className="k gold">{CARD_META[t].name}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/card/${t}`} alt={`${CARD_META[t].name} card`} width={1200} height={675} style={{ width: "100%", maxWidth: 1000, height: "auto", borderRadius: 24, border: "1px solid rgba(243,238,230,.12)" }} />
        {card ? <p className="soft" style={{ margin: 0, fontSize: 19, maxWidth: "46em" }}>{card.caption}</p> : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {card ? <a className="btn btn-g" href={intentUrl(t, card.caption)} target="_blank" rel="noopener">Share on X</a> : null}
          <Link className="btn btn-o" href="/">More on Purple Dinos</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
