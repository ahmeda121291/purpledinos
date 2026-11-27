import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GradesView from "@/components/GradesView";
import { getLatestGrades } from "@/lib/cards";
import { db } from "@/lib/supabase";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Jurassic Park Grades · Grade the Raptors · Purple Dinos",
  description: "Grade every Raptor after every game, then see how your grades stack up against the numbers.",
  alternates: { canonical: "/grades" },
  openGraph: { images: ["/api/card/grades"] },
  twitter: { card: "summary_large_image", images: ["/api/card/grades"] },
};

export default async function Grades() {
  const [g, { data: history }] = await Promise.all([getLatestGrades(), db.rpc("recent_grade_games", { p_limit: 12 })]);
  if (!g) notFound();
  return <GradesView g={g} history={(history as never[]) ?? []} latestId={g.game.game_id} />;
}
