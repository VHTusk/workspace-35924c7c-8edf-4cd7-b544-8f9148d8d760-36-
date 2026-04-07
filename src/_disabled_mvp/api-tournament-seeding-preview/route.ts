import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus, BracketFormat } from '@prisma/client';
import { 
  generateSeedings, 
  previewSeedings, 
  saveSeedings,
  seedByElo,
  seedRandom,
  seedHybrid,
  applyAntiCollision,
  applyTopSeedProtection,
  SeedAssignment,
  SeedingOptions,
  getSeedingStats,
  validateSeeding,
} from '@/lib/seeding';
import { generateSwissPairings, calculateSwissRounds, getSwissStandings } from '@/lib/swiss-pairing';
import { getOrgSession } from '@/lib/auth/org-session';
import { safeParseInt } from '@/lib/validation';

/**
 * GET /api/tournaments/[id]/seeding/preview
 * Returns seeding preview without applying
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const method = (searchParams.get('method') || 'ELO') as SeedingOptions['method'];
    const antiCollision = searchParams.get('antiCollision') === 'true';
    const topSeedProtection = searchParams.get('topSeedProtection') === 'true';
    const topN = safeParseInt(searchParams.get('topN'), 8, 1, 64);

    // Get tournament with registrations
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                hiddenElo: true,
                visiblePoints: true,
                affiliatedOrgId: true,
                affiliatedOrg: {
                  select: { name: true }
                }
              }
            }
          }
        },
        bracket: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check if bracket already exists
    const bracketExists = !!tournament.bracket;

    // Get seeding options
    const options: SeedingOptions = {
      method,
      antiCollision,
      topSeedProtection,
      topN,
    };

    // Generate preview based on format
    let preview: {
      assignments: SeedAssignment[];
      bracketPreview: Array<{ match: number; playerA: string; playerB: string; seedA: number; seedB: number }>;
    };

    if (tournament.bracketFormat === BracketFormat.SWISS || method === 'SWISS') {
      // Swiss format preview
      const playerIds = tournament.registrations.map(r => r.userId);
      const seedResult = await seedByElo(playerIds);
      
      preview = {
        assignments: seedResult.seeds,
        bracketPreview: [],
      };

      // Add Swiss-specific info
      const swissRounds = calculateSwissRounds(tournament.registrations.length);
      
      return NextResponse.json({
        success: true,
        data: {
          tournamentId: id,
          format: 'SWISS',
          method,
          playerCount: tournament.registrations.length,
          bracketExists,
          preview: preview.assignments.map((a, i) => ({
            seed: a.seed,
            userId: a.userId,
            playerName: tournament.registrations.find(r => r.userId === a.userId)?.user ? 
              `${tournament.registrations.find(r => r.userId === a.userId)!.user.firstName} ${tournament.registrations.find(r => r.userId === a.userId)!.user.lastName}` : 
              'Unknown',
            elo: a.elo,
            org: tournament.registrations.find(r => r.userId === a.userId)?.user.affiliatedOrg?.name || null,
          })),
          swissInfo: {
            recommendedRounds: swissRounds,
            description: `Swiss tournament with ${tournament.registrations.length} players over ${swissRounds} rounds`,
          },
          stats: await getSeedingStats(id),
        }
      });
    }

    // Standard elimination bracket preview
    const previewResult = await previewSeedings(id, options);
    preview = previewResult;

    // Build detailed player info
    const playerDetails = preview.assignments.map(a => {
      const reg = tournament.registrations.find(r => r.userId === a.userId);
      return {
        seed: a.seed,
        userId: a.userId,
        playerName: reg ? `${reg.user.firstName} ${reg.user.lastName}` : 'Unknown',
        elo: a.elo,
        org: reg?.user.affiliatedOrg?.name || null,
        orgId: a.orgId,
        reason: a.reason,
      };
    });

    // Get seeding statistics
    const stats = await getSeedingStats(id);

    // Validate seeding
    const validation = validateSeeding(preview.assignments);

    // Check for potential collisions
    const orgGroups = new Map<string, number[]>();
    for (const p of playerDetails) {
      if (p.orgId) {
        if (!orgGroups.has(p.orgId)) {
          orgGroups.set(p.orgId, []);
        }
        orgGroups.get(p.orgId)!.push(p.seed);
      }
    }

    const collisions: Array<{ orgId: string; seeds: number[]; warning: string }> = [];
    for (const [orgId, seeds] of orgGroups) {
      // Check if same-org players might meet early
      for (let i = 0; i < seeds.length; i++) {
        for (let j = i + 1; j < seeds.length; j++) {
          const seedA = seeds[i];
          const seedB = seeds[j];
          // In standard bracket, players meet in round based on seed difference
          const potentialRound = Math.log2(Math.abs(seedA - seedB));
          if (potentialRound < 3 && potentialRound >= 0) {
            const org = playerDetails.find(p => p.orgId === orgId)?.org || 'Unknown Org';
            collisions.push({
              orgId,
              seeds: [seedA, seedB],
              warning: `Players from ${org} (seeds ${seedA}, ${seedB}) could meet in round ${Math.ceil(potentialRound + 1)}`,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tournamentId: id,
        format: tournament.bracketFormat || 'SINGLE_ELIMINATION',
        method,
        playerCount: tournament.registrations.length,
        bracketExists,
        options: {
          antiCollision,
          topSeedProtection,
          topN,
        },
        players: playerDetails,
        bracketPreview: preview.bracketPreview,
        stats,
        validation,
        collisions: collisions.length > 0 ? collisions : undefined,
        recommendations: generateRecommendations(stats, collisions, bracketExists),
      }
    });

  } catch (error) {
    console.error('Error generating seeding preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate seeding preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/[id]/seeding/preview
 * Apply seeding to tournament
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgSession();
    
    // Check authorization
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      method = 'ELO', 
      antiCollision = true, 
      topSeedProtection = true,
      topN = 8,
      forceRegenerate = false,
    } = body;

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          where: { status: 'CONFIRMED' },
        },
        bracket: {
          include: { matches: true }
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check ownership (for org tournaments)
    if (tournament.orgId && tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if tournament is in correct status
    const allowedStatuses = [
      TournamentStatus.REGISTRATION_CLOSED,
      TournamentStatus.REGISTRATION_OPEN,
      TournamentStatus.DRAFT,
    ];

    if (!allowedStatuses.includes(tournament.status)) {
      return NextResponse.json(
        { error: `Cannot apply seeding: tournament is ${tournament.status}` },
        { status: 400 }
      );
    }

    // Check if bracket exists
    if (tournament.bracket && !forceRegenerate) {
      return NextResponse.json(
        { error: 'Bracket already exists. Use forceRegenerate=true to re-seed.' },
        { status: 400 }
      );
    }

    // Validate minimum players
    if (tournament.registrations.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 players to apply seeding' },
        { status: 400 }
      );
    }

    // Generate seedings
    const options: SeedingOptions = {
      method,
      antiCollision,
      topSeedProtection,
      topN,
    };

    const assignments = await generateSeedings(id, options);

    // Validate seeding
    const validation = validateSeeding(assignments);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid seeding generated', issues: validation.issues },
        { status: 500 }
      );
    }

    // Delete existing bracket if force regenerate
    if (tournament.bracket && forceRegenerate) {
      await db.bracket.delete({
        where: { tournamentId: id },
      });
    }

    // For Swiss tournaments
    if (tournament.bracketFormat === BracketFormat.SWISS || method === 'SWISS') {
      const swissRounds = calculateSwissRounds(tournament.registrations.length);

      // Create Swiss bracket
      const bracket = await db.bracket.create({
        data: {
          tournamentId: id,
          format: BracketFormat.SWISS,
          totalRounds: swissRounds,
          seedingMethod: 'SWISS',
          generatedById: session.orgId || 'system',
        },
      });

      // Update tournament status
      await db.tournament.update({
        where: { id },
        data: { status: TournamentStatus.BRACKET_GENERATED },
      });

      return NextResponse.json({
        success: true,
        message: 'Swiss tournament seeding applied successfully',
        data: {
          bracketId: bracket.id,
          format: 'SWISS',
          totalRounds: swissRounds,
          playerCount: assignments.length,
          seedingMethod: method,
        }
      });
    }

    // For elimination brackets
    // Calculate bracket size (next power of 2)
    const playerCount = assignments.length;
    let bracketSize = 2;
    while (bracketSize < playerCount) {
      bracketSize *= 2;
    }
    const totalRounds = Math.log2(bracketSize);

    // Create bracket
    const bracket = await db.bracket.create({
      data: {
        tournamentId: id,
        format: tournament.bracketFormat || BracketFormat.SINGLE_ELIMINATION,
        totalRounds,
        seedingMethod: method,
        generatedById: session.orgId || 'system',
      },
    });

    // Create bracket matches with seeded players
    const matchCount = bracketSize / 2;
    const matchPromises = [];

    for (let i = 0; i < matchCount; i++) {
      const seedA = getSeedForMatchPosition(i, 'A', playerCount, bracketSize);
      const seedB = getSeedForMatchPosition(i, 'B', playerCount, bracketSize);

      const playerA = assignments.find(a => a.seed === seedA);
      const playerB = assignments.find(a => a.seed === seedB);

      // Create match
      const matchPromise = db.match.create({
        data: {
          sport: tournament.sport,
          tournamentId: id,
          playerAId: playerA?.userId,
          playerBId: playerB?.userId,
          outcome: (!playerA || !playerB) ? 'BYE' : undefined,
          winnerId: (!playerA && playerB) ? playerB.userId : (playerA && !playerB) ? playerA.userId : undefined,
        },
      });

      matchPromises.push(matchPromise);
    }

    const matches = await Promise.all(matchPromises);

    // Create bracket match entries
    const bracketMatchPromises = matches.map((match, i) => {
      const seedA = getSeedForMatchPosition(i, 'A', playerCount, bracketSize);
      const seedB = getSeedForMatchPosition(i, 'B', playerCount, bracketSize);
      const playerA = assignments.find(a => a.seed === seedA);
      const playerB = assignments.find(a => a.seed === seedB);
      const isBye = !playerA || !playerB;

      return db.bracketMatch.create({
        data: {
          bracketId: bracket.id,
          matchId: match.id,
          roundNumber: 1,
          matchNumber: i + 1,
          playerAId: playerA?.userId,
          playerBId: playerB?.userId,
          status: isBye ? 'BYE' : 'PENDING',
          winnerId: isBye ? (playerA || playerB)?.userId : undefined,
        },
      });
    });

    await Promise.all(bracketMatchPromises);

    // Create empty matches for subsequent rounds
    for (let round = 2; round <= totalRounds; round++) {
      const roundMatchCount = bracketSize / Math.pow(2, round);
      for (let m = 0; m < roundMatchCount; m++) {
        await db.bracketMatch.create({
          data: {
            bracketId: bracket.id,
            roundNumber: round,
            matchNumber: m + 1,
            status: 'PENDING',
          },
        });
      }
    }

    // Update tournament status
    await db.tournament.update({
      where: { id },
      data: { status: TournamentStatus.BRACKET_GENERATED },
    });

    return NextResponse.json({
      success: true,
      message: 'Seeding applied successfully',
      data: {
        bracketId: bracket.id,
        format: tournament.bracketFormat || 'SINGLE_ELIMINATION',
        totalRounds,
        playerCount: assignments.length,
        bracketSize,
        byes: bracketSize - playerCount,
        seedingMethod: method,
        antiCollisionApplied: antiCollision,
        topSeedProtectionApplied: topSeedProtection,
      }
    });

  } catch (error) {
    console.error('Error applying seeding:', error);
    return NextResponse.json(
      { error: 'Failed to apply seeding', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tournaments/[id]/seeding/preview
 * Remove seeding and reset bracket
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: { bracket: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check ownership
    if (tournament.orgId && tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if tournament hasn't started
    if (tournament.status === TournamentStatus.IN_PROGRESS || 
        tournament.status === TournamentStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Cannot reset seeding for tournament in progress or completed' },
        { status: 400 }
      );
    }

    // Delete bracket
    if (tournament.bracket) {
      await db.bracket.delete({
        where: { tournamentId: id },
      });
    }

    // Update tournament status
    await db.tournament.update({
      where: { id },
      data: { status: TournamentStatus.REGISTRATION_CLOSED },
    });

    return NextResponse.json({
      success: true,
      message: 'Seeding reset successfully',
    });

  } catch (error) {
    console.error('Error resetting seeding:', error);
    return NextResponse.json(
      { error: 'Failed to reset seeding', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get seed number for a match position using standard bracket placement
 */
function getSeedForMatchPosition(
  matchIndex: number,
  position: 'A' | 'B',
  totalPlayers: number,
  bracketSize: number
): number {
  // Standard bracket seeding patterns
  const patterns: Record<number, number[][]> = {
    4: [[1, 4], [2, 3]],
    8: [[1, 8], [4, 5], [2, 7], [3, 6]],
    16: [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]],
    32: [
      [1, 32], [16, 17], [8, 25], [9, 24],
      [4, 29], [13, 20], [5, 28], [12, 21],
      [2, 31], [15, 18], [7, 26], [10, 23],
      [3, 30], [14, 19], [6, 27], [11, 22]
    ],
    64: [
      [1, 64], [32, 33], [16, 49], [17, 48],
      [8, 57], [25, 40], [9, 56], [24, 41],
      [4, 61], [29, 36], [13, 52], [20, 45],
      [5, 60], [28, 37], [12, 53], [21, 44],
      [2, 63], [31, 34], [15, 50], [18, 47],
      [7, 58], [26, 39], [10, 55], [23, 42],
      [3, 62], [30, 35], [14, 51], [19, 46],
      [6, 59], [27, 38], [11, 54], [22, 43]
    ]
  };

  const pattern = patterns[bracketSize];
  if (pattern && matchIndex < pattern.length) {
    return position === 'A' ? pattern[matchIndex][0] : pattern[matchIndex][1];
  }

  // Fallback for non-standard sizes
  if (position === 'A') {
    return Math.min(matchIndex + 1, totalPlayers);
  } else {
    return Math.min(bracketSize - matchIndex, totalPlayers) || null;
  }
}

/**
 * Generate recommendations based on seeding stats
 */
function generateRecommendations(
  stats: {
    playerCount: number;
    avgElo: number;
    eloRange: number;
    orgsRepresented: number;
    playersWithOrg: number;
  },
  collisions: Array<{ orgId: string; seeds: number[]; warning: string }>,
  bracketExists: boolean
): string[] {
  const recommendations: string[] = [];

  if (bracketExists) {
    recommendations.push('Bracket already exists. Use force regenerate to re-seed.');
  }

  if (stats.eloRange > 500) {
    recommendations.push('Large ELO range detected. Consider using hybrid seeding to protect top players.');
  }

  if (collisions.length > 0) {
    recommendations.push('Same-organization players may meet early. Enable anti-collision to spread them apart.');
  }

  if (stats.playersWithOrg > stats.playerCount * 0.5 && stats.orgsRepresented > 1) {
    recommendations.push('Many players belong to organizations. Anti-collision recommended for fair play.');
  }

  if (stats.playerCount < 4) {
    recommendations.push('Few players registered. Consider round-robin format for more matches.');
  }

  if (!Number.isInteger(Math.log2(stats.playerCount))) {
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(stats.playerCount)));
    recommendations.push(`${nextPowerOf2 - stats.playerCount} byes will be needed for a ${nextPowerOf2}-player bracket.`);
  }

  return recommendations;
}
