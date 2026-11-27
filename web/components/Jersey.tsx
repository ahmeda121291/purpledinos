// Original Purple Dinos jersey-back avatar: last name + number. No likenesses.
const lastName = (n: string) => { const p = n.split(" "); return (p.length > 1 && /^(Jr\.?|II|III|IV)$/.test(p[p.length - 1]) ? p[p.length - 2] : p[p.length - 1]).toUpperCase(); };

export default function Jersey({ name, number, size = 120, title }: { name: string; number?: string | null; size?: number; title?: boolean }) {
  const ln = lastName(name);
  const id = `j${ln.replace(/[^A-Z]/g, "")}${number ?? ""}`;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title ? `${name} jersey, number ${number ?? ""}` : undefined} style={{ flex: "none", overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" /><stop offset=".55" stopColor="#5B32C9" /><stop offset="1" stopColor="#2E1470" />
        </linearGradient>
        <filter id={`${id}s`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".45" /></filter>
      </defs>
      <path filter={`url(#${id}s)`} d="M58 10 C70 10 76 30 100 30 C124 30 130 10 142 10 L176 22 C172 50 174 70 186 84 L180 206 C150 216 50 216 20 206 L14 84 C26 70 28 50 24 22 Z" fill={`url(#${id}g)`} stroke="#D9B878" strokeWidth="4" strokeLinejoin="round" />
      <path d="M62 14 C74 16 80 36 100 36 C120 36 126 16 138 14" fill="none" stroke="#D9B878" strokeWidth="3" opacity=".7" />
      <path d="M30 26 C34 52 32 70 20 86 M170 26 C166 52 168 70 180 86" fill="none" stroke="rgba(217,184,120,.55)" strokeWidth="3" />
      <text x="100" y="72" textAnchor="middle" fill="#F3EEE6" fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif" fontWeight="800" fontSize={ln.length > 9 ? 16 : 20} letterSpacing="2" textLength={ln.length > 6 ? 118 : undefined} lengthAdjust="spacingAndGlyphs">{ln}</text>
      <text x="100" y="168" textAnchor="middle" fill="#D9B878" fontFamily="'Bricolage Grotesque Variable', system-ui, sans-serif" fontWeight="800" fontSize="92" letterSpacing="-4" stroke="#0A090C" strokeWidth="2" paintOrder="stroke">{number ?? "–"}</text>
    </svg>
  );
}
