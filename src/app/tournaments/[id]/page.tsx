import { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentDetailClient } from "./tournament-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/public/tournaments/${id}`, {
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
  
  // Fetch tournament data server-side
  let tournament = null;
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/public/tournaments/${id}`, {
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
