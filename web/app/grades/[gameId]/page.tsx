import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GradesView from "@/components/GradesView";
import { getLatestGrades } from "@/lib/cards";
import { db } from "@/lib/supabase";
import { teamName } from "@/lib/teams";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params;
  const g = await getLatestGrades(gameId);
  if (!g) return {};
  const t = `Raptors ${g.game.team_pts}–${g.game.opp_pts} ${g.game.is_home ? "vs" : "at"} ${teamName(g.game.opponent_abbr)} · Jurassic Park Grades`;
  return { title: `${t} · Purple Dinos`, description: "Fan grades vs the numbers for every Raptor in this game.", alternates: { canonical: `/grades/${gameId}` } };
}

export default async function GradesGame({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const [g, latest, { data: history }] = await Promise.all([getLatestGrades(gameId), getLatestGrades(), db.rpc("recent_grade_games", { p_limit: 12 })]);
  if (!g) notFound();
  return <GradesView g={g} history={(history as never[]) ?? []} latestId={latest?.game.game_id ?? ""} />;
}
