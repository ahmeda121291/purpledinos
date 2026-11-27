import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { LogoMark } from "@/components/Logo";
import { CARD_META, CARD_TYPES, getCard, intentUrl } from "@/lib/cards";

export const revalidate = 300;
export const metadata: Metadata = { title: "Card preview · Purple Dinos", robots: { index: false, follow: false } };

// Private preview of every post card, laid out the way it will look on X.
export default async function Cards() {
  const cards = await Promise.all(CARD_TYPES.map(async (t) => ({ t, card: await getCard(t).catch(() => null) })));
  return (
    <div style={{ overflow: "hidden" }}>
      <Header active="none" />
      <main className="wrap" style={{ paddingTop: 64 }}>
        <div className="k gold" style={{ marginBottom: 12 }}>Preview · not public</div>
        <h1 className="h2" style={{ marginBottom: 12 }}>Post <span className="se" style={{ fontSize: "1.1em" }}>cards</span></h1>
        <p className="soft" style={{ margin: "0 0 48px", maxWidth: "42em" }}>Every card, with today&apos;s real numbers, exactly as it will post on X. Each one also has its own share page with a Share on X button.</p>
        <div style={{ display: "grid", gap: 40, gridTemplateColumns: "repeat(auto-fit, minmax(min(560px, 100%), 1fr))" }}>
          {cards.map(({ t, card }) => (
            <section key={t} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span className="k gold">{CARD_META[t].name}</span>
                <span className="k muted">{CARD_META[t].when}</span>
              </div>
              <article style={{ background: "#000", border: "1px solid #2F3336", borderRadius: 16, padding: 16, display: "flex", gap: 12, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
                <LogoMark size={40} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 15 }}><strong style={{ color: "#E7E9EA" }}>Purple Dinos</strong> <span style={{ color: "#71767B" }}>@PurpleDinosTO · now</span></div>
                  <p style={{ margin: 0, color: "#E7E9EA", fontSize: 15, lineHeight: 1.4 }}>{card?.caption ?? "No card today: the data for this one isn't available right now."}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/card/${t}`} alt={`${CARD_META[t].name} card`} width={1200} height={675} style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid #2F3336", marginTop: 6 }} />
                </div>
              </article>
              {card ? (
                <div style={{ display: "flex", gap: 16, fontSize: 14 }}>
                  <a href={`/c/${t}`}>Share page</a>
                  <a href={intentUrl(t, card.caption)} target="_blank" rel="noopener">Test share on X</a>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
