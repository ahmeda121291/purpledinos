export function LogoMark({ size = 46 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" style={{ width: size, height: size, flex: "none" }}>
      <defs>
        <linearGradient id="mG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9A72F5" />
          <stop offset=".5" stopColor="#6B3FD4" />
          <stop offset="1" stopColor="#2E1470" />
        </linearGradient>
        <clipPath id="mC">
          <circle cx="200" cy="200" r="174" />
        </clipPath>
      </defs>
      <circle cx="200" cy="200" r="174" fill="#15121C" />
      <g clipPath="url(#mC)" fill="url(#mG)">
        <path d="M96,400 C92,330 92,240 132,172 C150,136 196,108 244,108 C286,108 322,132 344,170 C354,188 350,208 332,210 C296,214 262,212 236,202 C262,224 294,238 320,238 C333,239 333,257 319,261 C288,270 258,270 240,280 C236,310 240,360 252,400 Z" />
        <path d="M180,124 C140,104 108,100 80,108 C104,120 122,138 132,170 Z" />
        <path d="M134,168 C110,156 88,154 64,162 C86,172 100,190 110,216 Z" />
        <path d="M112,214 C92,208 76,210 58,220 C78,226 90,242 100,262 Z" />
      </g>
      <path d="M246,146 L292,163 C272,172 254,166 246,146 Z" fill="#D9B878" />
      <circle cx="200" cy="200" r="182" fill="none" stroke="#D9B878" strokeWidth="8" />
    </svg>
  );
}

export function Wordmark({ size = 21 }: { size?: number }) {
  return (
    <span className="wm" style={{ fontWeight: 800, fontSize: size, letterSpacing: "-.03em", lineHeight: 1 }}>
      <span className="wm-p">PURPLE</span> <span className="se" style={{ fontSize: size * 1.2 }}>Dinos</span>
    </span>
  );
}
