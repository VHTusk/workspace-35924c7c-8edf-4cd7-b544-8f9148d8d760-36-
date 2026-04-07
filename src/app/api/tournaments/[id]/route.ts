import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                city: true,
                hiddenElo: true,
              },
            },
          },
        },
        teamRegistrations: {
          where: {
            status: { in: ['CONFIRMED', 'PENDING'] }
          },
          include: {
            team: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        hiddenElo: true,
                      }
                    }
                  }
                }
              }
            }
          }
        },
        hostOrg: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          }
        },
        bracket: {
          include: {
            matches: true,
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Calculate tier for each player
    const registrationsWithTier = tournament.registrations.map((r) => {
      const elo = r.user.hiddenElo;
      const tier = elo >= 1900 ? 'DIAMOND' : 
                   elo >= 1700 ? 'PLATINUM' :
                   elo >= 1500 ? 'GOLD' :
                   elo >= 1300 ? 'SILVER' : 'BRONZE';

      return {
        ...r,
        user: {
          ...r.user,
          tier,
          name: `${r.user.firstName} ${r.user.lastName}`,
        },
      };
    });

    return NextResponse.json({
      tournament: {
        ...tournament,
        registrations: registrationsWithTier,
        registeredPlayers: tournament.registrations.length,
      },
    });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
