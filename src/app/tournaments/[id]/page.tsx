import { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { buildAppUrl, getRequestOrigin } from "@/lib/app-url";
import { TournamentDetailClient } from "./tournament-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const requestHeaders = await headers();
  const baseUrl = getRequestOrigin(requestHeaders);
  
  try {
    const response = await fetch(buildAppUrl(`/api/public/tournaments/${id}`, baseUrl), {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      return { title: "Tournament Not Found | VALORHIVE" };
    }
    
    const data = await response.json();
    const tournament = data.tournament;
    
    return {
      title: `${tournament.name} | VALORHIVE`,
      description: `${tournament.sport} tournament in ${tournament.location}. ${tournament.prizePool > 0 ? `Prize pool: ₹${tournament.prizePool.toLocaleString('en-IN')}` : ''}. ${tournament.status === 'REGISTRATION_OPEN' ? 'Registration open!' : ''}`,
    };
  } catch {
    return { title: "Tournament | VALORHIVE" };
  }
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const requestHeaders = await headers();
  const baseUrl = getRequestOrigin(requestHeaders);
  
  // Fetch tournament data server-side
  let tournament = null;
  
  try {
    const response = await fetch(buildAppUrl(`/api/public/tournaments/${id}`, baseUrl), {
      cache: 'no-store',
    });
    
    if (response.ok) {
      const data = await response.json();
      tournament = data.tournament;
    }
  } catch (error) {
    console.error('Error fetching tournament:', error);
  }
  
  if (!tournament) {
    notFound();
  }
  
  return <TournamentDetailClient initialTournament={tournament} />;
}
