import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicPlayerClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sport?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { sport } = await searchParams;

  const player = await db.user.findUnique({
    where: { id },
    select: {
      firstName: true,
      lastName: true,
      city: true,
      state: true,
      isAnonymized: true,
      isActive: true,
    },
  });

  if (!player || player.isAnonymized || !player.isActive) {
    return { title: "Player Not Found" };
  }

  const name = `${player.firstName} ${player.lastName}`;
  const location = [player.city, player.state].filter(Boolean).join(", ");
  const sportLabel = sport ? ` ${sport.charAt(0) + sport.slice(1).toLowerCase()}` : "";

  return {
    title: `${name} | VALORHIVE Player`,
    description: `View ${name}'s${sportLabel} profile on VALORHIVE.${location ? ` Player from ${location}.` : ""} See stats, achievements, and tournament history.`,
    openGraph: {
      title: `${name} | VALORHIVE Player`,
      description: `View ${name}'s${sportLabel} profile on VALORHIVE.${location ? ` Player from ${location}.` : ""}`,
      type: "profile",
      images: [`/api/og?player=${id}`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | VALORHIVE Player`,
      description: `View ${name}'s${sportLabel} profile on VALORHIVE.${location ? ` Player from ${location}.` : ""}`,
    },
  };
}

export default async function PublicPlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { sport } = await searchParams;

  const player = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      isAnonymized: true,
      isActive: true,
    },
  });

  if (!player || player.isAnonymized || !player.isActive) {
    notFound();
  }

  return <PublicPlayerClient playerId={id} sport={sport || null} />;
}
