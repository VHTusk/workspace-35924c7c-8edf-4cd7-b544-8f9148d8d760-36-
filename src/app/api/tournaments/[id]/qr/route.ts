import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sport: true,
        location: true,
        startDate: true,
        endDate: true,
        status: true,
        entryFee: true,
        maxPlayers: true,
        registrations: { select: { id: true } }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Generate QR code data (URL to tournament registration page)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const registrationUrl = `${baseUrl}/${tournament.sport.toLowerCase()}/tournaments/${id}`;

    // For QR code, we'll return the URL that can be encoded
    // The frontend will generate the actual QR image
    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
        location: tournament.location,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        status: tournament.status,
        entryFee: tournament.entryFee,
        spotsRemaining: tournament.maxPlayers - tournament.registrations.length
      },
      qrData: registrationUrl,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(registrationUrl)}`
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
