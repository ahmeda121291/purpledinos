export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, textAlign: "center" }}>
      <div>
        <p style={{ letterSpacing: 4, fontSize: 13, color: "#FF3B6B", fontWeight: 700, margin: 0 }}>
          RAPTORS BASKETBALL, BY THE NUMBERS
        </p>
        <h1 style={{ fontSize: "clamp(56px, 12vw, 140px)", lineHeight: 0.95, margin: "16px 0", letterSpacing: 2 }}>
          PURPLE DINOS
        </h1>
        <p style={{ fontSize: 18, color: "#CFC6DC", margin: 0 }}>Launching soon. Made in the 6ix.</p>
        <p style={{ marginTop: 24 }}>
          <a href="https://x.com/PurpleDinos" style={{ color: "#C7A6FF", fontWeight: 600 }}>
            Follow @PurpleDinos
          </a>
        </p>
      </div>
    </main>
  );
}
