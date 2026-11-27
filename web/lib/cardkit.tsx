/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const W = 1200, H = 675;
export const GOLD = "#D9B878", INK = "#F3EEE6", MUTED = "#A8A29A", SOFT = "#CFC9BF", LILAC = "#B9A4F0", PURPLE = "#6B3FD4";
export const MONO = "JetBrains Mono", SERIF = "Instrument Serif", SANS = "Bricolage";

export const fonts = async () => {
  const load = (f: string) => readFile(join(process.cwd(), "assets", "fonts", f));
  const [r4, r6, r8, se, mo] = await Promise.all([
    load("bricolage-grotesque-latin-400-normal.woff"), load("bricolage-grotesque-latin-600-normal.woff"),
    load("bricolage-grotesque-latin-800-normal.woff"), load("instrument-serif-latin-400-italic.woff"),
    load("jetbrains-mono-latin-500-normal.woff"),
  ]);
  return [
    { name: SANS, data: r4, weight: 400 as const, style: "normal" as const },
    { name: SANS, data: r6, weight: 600 as const, style: "normal" as const },
    { name: SANS, data: r8, weight: 800 as const, style: "normal" as const },
    { name: SERIF, data: se, weight: 400 as const, style: "italic" as const },
    { name: MONO, data: mo, weight: 500 as const, style: "normal" as const },
  ];
};

export const Logo = ({ size = 52 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9A72F5" /><stop offset=".5" stopColor="#6B3FD4" /><stop offset="1" stopColor="#2E1470" /></linearGradient>
      <clipPath id="c"><circle cx="200" cy="200" r="174" /></clipPath>
    </defs>
    <circle cx="200" cy="200" r="174" fill="#15121C" />
    <g clipPath="url(#c)" fill="url(#g)">
      <path d="M96,400 C92,330 92,240 132,172 C150,136 196,108 244,108 C286,108 322,132 344,170 C354,188 350,208 332,210 C296,214 262,212 236,202 C262,224 294,238 320,238 C333,239 333,257 319,261 C288,270 258,270 240,280 C236,310 240,360 252,400 Z" />
      <path d="M180,124 C140,104 108,100 80,108 C104,120 122,138 132,170 Z" />
      <path d="M134,168 C110,156 88,154 64,162 C86,172 100,190 110,216 Z" />
      <path d="M112,214 C92,208 76,210 58,220 C78,226 90,242 100,262 Z" />
    </g>
    <path d="M246,146 L292,163 C272,172 254,166 246,146 Z" fill={GOLD} />
    <circle cx="200" cy="200" r="182" fill="none" stroke={GOLD} strokeWidth="10" />
  </svg>
);

export const K = ({ children, color = GOLD, size = 18 }: any) => (
  <div style={{ display: "flex", fontFamily: MONO, fontSize: size, letterSpacing: 3, textTransform: "uppercase", color }}>{children}</div>
);
export const Serif = ({ children, size, color = GOLD }: any) => <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: size, color, fontWeight: 400 }}>{children}</span>;

export function Frame({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", background: "#0A090C", color: INK, fontFamily: SANS, padding: "44px 56px 36px" }}>
      <div style={{ position: "absolute", left: -260, top: -360, width: 900, height: 900, borderRadius: 450, background: "radial-gradient(circle, rgba(107,63,212,.55), rgba(107,63,212,0) 65%)", display: "flex" }} />
      <div style={{ position: "absolute", right: -260, bottom: -420, width: 820, height: 820, borderRadius: 410, background: "radial-gradient(circle, rgba(217,184,120,.18), rgba(217,184,120,0) 65%)", display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Logo />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: -1, color: "#A88BF8" }}>PURPLE</span>
            <Serif size={36}>Dinos</Serif>
          </div>
        </div>
        <div style={{ display: "flex", padding: "10px 20px", borderRadius: 999, border: `1.5px solid rgba(217,184,120,.55)`, background: "rgba(10,9,12,.55)" }}><K size={17}>{label}</K></div>
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", position: "relative" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1.5px solid rgba(217,184,120,.35)", paddingTop: 18 }}>
        <K size={18}>purpledinos.ca</K>
        <div style={{ display: "flex", fontFamily: MONO, fontSize: 18, letterSpacing: 2, color: SOFT }}>@PurpleDinosTO · MADE IN THE 6IX</div>
      </div>
    </div>
  );
}

