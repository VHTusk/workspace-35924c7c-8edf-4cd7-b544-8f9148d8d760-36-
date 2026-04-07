/**
 * Seeding API for VALORHIVE Tournaments
 * 
 * GET: Return seeding preview without applying
 * POST: Apply seeding to tournament
 * 
 * Supports:
 * - ELO-based seeding
 * - Random seeding
 * - Hybrid seeding (top N by ELO, rest random)
 * - Anti-collision rules for same-org players
 * - Top seed protection for bracket balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TournamentStatus, BracketFormat, SportType } from '@prisma/client';
import { 
  seedByElo,
  seedRandom,
  seedHybrid,
  applyAntiCollision,
  applyTopSeedProtection,
  SeedAssignment,
  SeedingOptions,
  getSeedingStats,
  validateSeeding,
  getSeedingPreview,
} from '@/lib/seeding';
import { getOrgSession } from '@/lib/auth/org-session';
import { validateSession } from '@/lib/session';
import { safeParseInt } from '@/lib/validation';

/**
 * GET /api/tournaments/[id]/seeding
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

    // Get seeding preview
    const seedingPreview = await getSeedingPreview(id);

    if (!seedingPreview.success) {
      return NextResponse.json({
        success: false,
        error: seedingPreview.warnings[0] || 'Failed to generate seeding preview',
        data: {
          tournamentId: id,
          playerCount: 0,
          bracketExists,
        }
      });
    }

    // Apply anti-collision if requested
    let finalSeeds = seedingPreview.seeds;
    if (antiCollision) {
      finalSeeds = applyAntiCollision(finalSeeds);
    }

    // Apply top seed protection if requested
    if (topSeedProtection) {
      finalSeeds = applyTopSeedProtection(finalSeeds);
    }

    // Build detailed player info
    const playerDetails = finalSeeds.map(seed => {
      const reg = tournament.registrations.find(r => r.userId === seed.userId);
      return {
        seed: seed.seed,
        userId: seed.userId,
        playerName: seed.playerName || (reg ? `${reg.user.firstName} ${reg.user.lastName}` : 'Unknown'),
        elo: seed.elo,
        org: reg?.user.affiliatedOrg?.name || null,
        orgId: seed.orgId,
        reason: seed.reason,
      };
    });

    // Get seeding statistics
    const stats = await getSeedingStats(id);

    // Validate seeding
    const validation = validateSeeding(finalSeeds);

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

    // Generate recommendations
    const recommendations: string[] = [];
    if (bracketExists) {
      recommendations.push('Bracket already exists. Use POST to regenerate with force=true.');
    }
    if (stats.eloRange > 500) {
      recommendations.push('Large ELO range detected. Consider using hybrid seeding to protect top players.');
    }
    if (collisions.length > 0) {
      recommendations.push('Same-organization players may meet early. Enable anti-collision to spread them apart.');
    }
    if (!Number.isInteger(Math.log2(stats.playerCount))) {
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(stats.playerCount)));
      recommendations.push(`${nextPowerOf2 - stats.playerCount} byes will be needed for a ${nextPowerOf2}-player bracket.`);
    }

    return NextResponse.json({
      success: true,
      data: {
        tournamentId: id,
        format: tournament.bracketFormat || 'SINGLE_ELIMINATION',
        sport: tournament.sport,
        method,
        playerCount: tournament.registrations.length,
        bracketExists,
        options: {
          antiCollision,
          topSeedProtection,
          topN,
        },
        players: playerDetails,
        stats,
        validation,
        collisions: collisions.length > 0 ? collisions : undefined,
        recommendations,
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
 * POST /api/tournaments/[id]/seeding
 * Apply seeding to tournament
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check authorization - allow both org sessions and player sessions
    const orgSession = await getOrgSession();
    const playerSession = await validateSession();
    
    if (!orgSession && !playerSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      method = 'ELO', 
      antiCollision = true, 
      topSeedProtection = true,
      topN = 8,
      forceRegenerate = false,
    } = body as {
      method: SeedingOptions['method'];
      antiCollision?: boolean;
      topSeedProtection?: boolean;
      topN?: number;
      forceRegenerate?: boolean;
    };

    // Get tournament
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
                affiliatedOrgId: true,
              }
            }
          }
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
    if (tournament.orgId && orgSession && tournament.orgId !== orgSession.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if tournament is in correct status
    const allowedStatuses: TournamentStatus[] = [
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

    // Generate seedings based on method
    const playerIds = tournament.registrations.map(r => r.userId);
    let seedResult: { seeds: SeedAssignment[]; method: string };

    switch (method) {
      case 'ELO':
        const eloResult = await seedByElo(playerIds, tournament.sport as SportType);
        seedResult = { seeds: eloResult.seeds, method: 'ELO' };
        break;
      case 'RANDOM':
        const randomResult = seedRandom(playerIds);
        seedResult = { seeds: randomResult.seeds, method: 'RANDOM' };
        break;
      case 'HYBRID':
        const hybridResult = await seedHybrid(playerIds, topN, tournament.sport as SportType);
        seedResult = { seeds: hybridResult.seeds, method: 'HYBRID' };
        break;
      default:
        const defaultResult = await seedByElo(playerIds, tournament.sport as SportType);
        seedResult = { seeds: defaultResult.seeds, method: 'ELO' };
    }

    // Apply anti-collision if enabled
    let assignments = seedResult.seeds;
    if (antiCollision) {
      assignments = applyAntiCollision(assignments);
    }

    // Apply top seed protection if enabled
    if (topSeedProtection) {
      assignments = applyTopSeedProtection(assignments);
    }

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
    if (tournament.bracketFormat === BracketFormat.SWISS) {
      const swissRounds = Math.ceil(Math.log2(assignments.length));

      // Create Swiss bracket
      const bracket = await db.bracket.create({
        data: {
          tournamentId: id,
          format: BracketFormat.SWISS,
          totalRounds: swissRounds,
          seedingMethod: method,
          generatedById: orgSession?.orgId || playerSession?.userId || 'system',
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
          antiCollisionApplied: antiCollision,
          topSeedProtectionApplied: topSeedProtection,
          seeds: assignments.map(a => ({
            seed: a.seed,
            userId: a.userId,
            playerName: a.playerName,
            elo: a.elo,
          })),
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
        generatedById: orgSession?.orgId || playerSession?.userId || 'system',
      },
    });

    // Create bracket matches with seeded players
    const matchCount = bracketSize / 2;
    const matchPromises = [];

    for (let i = 0; i < matchCount; i++) {
      const { seedA, seedB } = getSeedsForMatch(i, playerCount, bracketSize);

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
      const { seedA, seedB } = getSeedsForMatch(i, playerCount, bracketSize);
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
        seeds: assignments.map(a => ({
          seed: a.seed,
          userId: a.userId,
          playerName: a.playerName,
          elo: a.elo,
        })),
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
 * DELETE /api/tournaments/[id]/seeding
 * Remove seeding and reset bracket
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgSession = await getOrgSession();
    const playerSession = await validateSession();
    
    if (!orgSession && !playerSession) {
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
    if (tournament.orgId && orgSession && tournament.orgId !== orgSession.orgId) {
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
 * Get seed numbers for a match position using standard bracket placement
 */
function getSeedsForMatch(
  matchIndex: number,
  totalPlayers: number,
  bracketSize: number
): { seedA: number; seedB: number } {
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
    return { seedA: pattern[matchIndex][0], seedB: pattern[matchIndex][1] };
  }

  // Fallback for non-standard sizes
  return {
    seedA: Math.min(matchIndex + 1, totalPlayers),
    seedB: Math.min(bracketSize - matchIndex, totalPlayers) || 0,
  };
}
