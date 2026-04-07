import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicBracketClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const tournament = await db.tournament.findUnique({
    where: { id },
    select: {
      name: true,
      sport: true,
      status: true,
      bracket: { select: { id: true } },
    },
  });

  if (!tournament || !tournament.bracket) {
    return { title: "Bracket Not Found" };
  }

  const sportName = tournament.sport.charAt(0) + tournament.sport.slice(1).toLowerCase();
  const isLive = tournament.status === "IN_PROGRESS";

  return {
    title: `${tournament.name} Bracket | VALORHIVE`,
    description: `${isLive ? "Live" : "View"} bracket for ${tournament.name} - ${sportName} tournament on VALORHIVE.`,
    openGraph: {
      title: `${tournament.name} Bracket | VALORHIVE`,
      description: `${isLive ? "Live" : "View"} bracket for ${tournament.name} - ${sportName} tournament.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${tournament.name} Bracket | VALORHIVE`,
      description: `${isLive ? "Live" : "View"} bracket for ${tournament.name}.`,
    },
  };
}

export default async function PublicBracketPage({ params }: Props) {
  const { id } = await params;

  const tournament = await db.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      bracket: { select: { id: true } },
    },
  });

  if (!tournament || tournament.status === "DRAFT" || !tournament.bracket) {
    notFound();
  }

  return <PublicBracketClient tournamentId={id} />;
}
