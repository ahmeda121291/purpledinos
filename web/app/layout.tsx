import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://purpledinos.ca"),
  title: "Purple Dinos · Raptors basketball from the 6ix",
  description: "Toronto Raptors numbers, lineups and history since 1995. Made in the 6ix.",
  openGraph: { title: "Purple Dinos", description: "Raptors basketball from the 6ix.", siteName: "Purple Dinos" },
  twitter: { card: "summary_large_image", site: "@PurpleDinosTO" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
