import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purple Dinos · Raptors basketball, by the numbers",
  description: "Toronto Raptors analytics, lineups and history. Made in the 6ix.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0B0812", color: "#F3EEF9", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
