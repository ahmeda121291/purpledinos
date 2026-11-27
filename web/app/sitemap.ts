import type { MetadataRoute } from "next";
import { getAllPlayers } from "@/lib/players";

export const revalidate = 86400;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://purpledinos.ca";
  const players = await getAllPlayers();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/stats-lab`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/grades`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/players`, changeFrequency: "weekly", priority: 0.8 },
    ...players.filter((p) => p.gp > 0).map((p) => ({ url: `${base}/players/${p.slug}`, changeFrequency: (p.is_active ? "daily" : "monthly") as "daily" | "monthly", priority: p.is_active ? 0.8 : 0.5 })),
  ];
}
