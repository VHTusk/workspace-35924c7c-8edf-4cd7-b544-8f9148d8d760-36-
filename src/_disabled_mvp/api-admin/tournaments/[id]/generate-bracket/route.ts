import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role, TournamentStatus, BracketMatchStatus, AuditAction, SportType, BracketFormat } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { canGenerateBracket, validateTransition, isValidTransition } from '@/lib/tournament-state-machine';
import { checkTDAssignment } from '@/lib/td-scoping';
import { checkAdminPermission, type PermissionKey } from '@/lib/admin-permissions';

// Generate tournament bracket
// Uses atomic transaction with UNIQUE constraint on Bracket.tournamentId for single-execution guarantee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = auth;

    // Verify user has appropriate role
    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id: tournamentId } = await params;
    const body = await request.json();
    const { seedingMethod = 'ELO' } = body;

    // ============================================
    // ATOMIC TRANSACTION with all validations
    // ============================================
    const result = await db.$transaction(async (tx) => {
      // Get tournament with lock to prevent concurrent bracket generation
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          registrations: {
            where: { status: 'CONFIRMED' },
            include: {
              user: {
                include: { rating: true },
              },
            },
          },
          bracket: true, // Will be null if no bracket exists
        },
      });

      if (!tournament) {
        throw new Error('TOURNAMENT_NOT_FOUND');
      }

      // ============================================
      // Cross-Sport Isolation Check
      // ============================================
      if (tournament.sport !== user.sport) {
        throw new Error('SPORT_MISMATCH');
      }

      // ============================================
      // TD Authorization Check
      // ============================================
      const tdCheck = await checkTDAssignment(user.id, tournamentId);
      if (!tdCheck.authorized) {
        throw new Error(`TD_UNAUTHORIZED:${tdCheck.error}`);
      }

      // ============================================
      // Permission Check (using new admin permission system)
      // ============================================
      const permissionResult = await checkAdminPermission(
        user.id,
        'canGenerateBracket' as PermissionKey,
        {
          sport: tournament.sport as SportType,
          tournamentId: tournament.id,
          stateCode: tournament.state || undefined,
          districtName: tournament.district || undefined,
        }
      );

      if (!permissionResult.granted) {
        // Fall back to role-based check if permission system doesn't grant access
        if (user.role !== Role.ADMIN && user.role !== Role.SUB_ADMIN) {
          throw new Error(`PERMISSION_DENIED:${permissionResult.reason || 'Insufficient permissions'}`);
        }
      }

      // ============================================
      // State Machine Validation
      // ============================================
      if (!canGenerateBracket(tournament.status)) {
        const allowedStatus = ['REGISTRATION_CLOSED'];
        throw new Error(`INVALID_STATUS:${tournament.status}:${allowedStatus.join(',')}`);
      }

      // ============================================
      // Single-Execution Guarantee
      // Bracket.tournamentId has UNIQUE constraint - database enforces single bracket per tournament
      // ============================================
      if (tournament.bracket) {
        throw new Error('BRACKET_ALREADY_EXISTS');
      }

      // Check if tournament has enough players
      const players = tournament.registrations;
      if (players.length < 2) {
        throw new Error('INSUFFICIENT_PLAYERS');
      }

      // Determine bracket size (power of 2)
      let bracketSize = 2;
      while (bracketSize < players.length) {
        bracketSize *= 2;
      }

      // Sort players by seeding method
      if (seedingMethod === 'ELO') {
        players.sort((a, b) => {
          const eloA = a.user.hiddenElo || 1500;
          const eloB = b.user.hiddenElo || 1500;
          return eloB - eloA; // Higher ELO first
        });
      } else {
        // Random seeding
        for (let i = players.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [players[i], players[j]] = [players[j], players[i]];
        }
      }

      // Fill bracket with players and byes
      const bracketPlayers: (typeof players[0] | null)[] = [...players];
      while (bracketPlayers.length < bracketSize) {
        bracketPlayers.push(null); // Bye
      }

      // Calculate rounds
      const totalRounds = Math.log2(bracketSize);
      const format = tournament.bracketFormat || BracketFormat.SINGLE_ELIMINATION;

      // ============================================
      // Create bracket - UNIQUE constraint on tournamentId ensures atomicity
      // ============================================
      const bracket = await tx.bracket.create({
        data: {
          tournamentId: tournament.id,
          format,
          totalRounds,
          seedingMethod,
          generatedById: user.id,
        },
      });

      // Generate first round matches
      const matchesPerRound = bracketSize / 2;
      const firstRoundMatches = [];

      for (let i = 0; i < matchesPerRound; i++) {
        const playerA = bracketPlayers[i * 2];
        const playerB = bracketPlayers[i * 2 + 1];

        const matchData: {
          bracketId: string;
          roundNumber: number;
          matchNumber: number;
          playerAId: string | null;
          playerBId: string | null;
          status: BracketMatchStatus;
          winnerId: string | null;
        } = {
          bracketId: bracket.id,
          roundNumber: 1,
          matchNumber: i + 1,
          playerAId: playerA?.userId || null,
          playerBId: playerB?.userId || null,
          status: BracketMatchStatus.PENDING,
          winnerId: null,
        };

        // Handle byes
        if (!playerA && playerB) {
          matchData.status = BracketMatchStatus.BYE;
          matchData.winnerId = playerB.userId;
        } else if (playerA && !playerB) {
          matchData.status = BracketMatchStatus.BYE;
          matchData.winnerId = playerA.userId;
        }

        firstRoundMatches.push(matchData);
      }

      // Create bracket matches
      await tx.bracketMatch.createMany({
        data: firstRoundMatches,
      });

      // Create subsequent round matches (empty) - FIXED: Batch create instead of N+1
      const subsequentRoundMatches: Array<{
        bracketId: string;
        roundNumber: number;
        matchNumber: number;
        status: BracketMatchStatus;
      }> = [];

      for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = Math.pow(2, totalRounds - round);
        for (let m = 0; m < roundMatches; m++) {
          subsequentRoundMatches.push({
            bracketId: bracket.id,
            roundNumber: round,
            matchNumber: m + 1,
            status: BracketMatchStatus.PENDING,
          });
        }
      }

      if (subsequentRoundMatches.length > 0) {
        await tx.bracketMatch.createMany({
          data: subsequentRoundMatches,
        });
      }

      // ============================================
      // Update tournament status with state machine validation
      // ============================================
      const transitionResult = validateTransition(tournament.status, TournamentStatus.BRACKET_GENERATED);
      if (!transitionResult.valid) {
        throw new Error(`INVALID_TRANSITION:${transitionResult.error}`);
      }

      await tx.tournament.update({
        where: { id: tournament.id },
        data: {
          status: TournamentStatus.BRACKET_GENERATED,
        },
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          sport: tournament.sport as SportType,
          action: AuditAction.BRACKET_GENERATED,
          actorId: user.id,
          actorRole: user.role as Role,
          targetType: 'Bracket',
          targetId: bracket.id,
          tournamentId: tournament.id,
          metadata: JSON.stringify({
            bracketSize,
            totalRounds,
            seedingMethod,
            format,
            playerCount: players.length,
            generatedByRole: user.role,
          }),
        },
      });

      return {
        bracket,
        tournament,
        bracketSize,
        totalRounds,
        playerCount: players.length,
      };
    });

    return NextResponse.json({
      success: true,
      bracket: {
        id: result.bracket.id,
        totalRounds: result.totalRounds,
        bracketSize: result.bracketSize,
        matchesGenerated: result.bracketSize - 1,
        playerCount: result.playerCount,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle specific errors
    if (errorMsg === 'TOURNAMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    
    if (errorMsg === 'SPORT_MISMATCH') {
      return NextResponse.json({ error: 'Tournament is for a different sport' }, { status: 400 });
    }
    
    if (errorMsg.startsWith('TD_UNAUTHORIZED:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json({ error: reason || 'Not authorized for this tournament' }, { status: 403 });
    }
    
    if (errorMsg.startsWith('PERMISSION_DENIED:')) {
      const reason = errorMsg.split(':')[1];
      return NextResponse.json({ 
        error: reason || 'Permission denied',
        escalationRequired: true
      }, { status: 403 });
    }
    
    if (errorMsg.startsWith('INVALID_STATUS:')) {
      const parts = errorMsg.split(':');
      return NextResponse.json(
        { error: `Cannot generate bracket in current status: ${parts[1]}. Required: ${parts[2]}` },
        { status: 400 }
      );
    }
    
    if (errorMsg === 'BRACKET_ALREADY_EXISTS') {
      return NextResponse.json(
        { error: 'Bracket already exists for this tournament. Delete it first to regenerate.', code: 'BRACKET_EXISTS' },
        { status: 400 }
      );
    }
    
    if (errorMsg === 'INSUFFICIENT_PLAYERS') {
      return NextResponse.json(
        { error: 'Need at least 2 confirmed players to generate bracket' },
        { status: 400 }
      );
    }
    
    if (errorMsg.startsWith('INVALID_TRANSITION:')) {
      return NextResponse.json(
        { error: errorMsg.split(':')[1] },
        { status: 400 }
      );
    }
    
    // Handle unique constraint violation (race condition)
    if (errorMsg.includes('Unique constraint') || errorMsg.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Bracket already exists for this tournament', code: 'BRACKET_EXISTS' },
        { status: 400 }
      );
    }
    
    console.error('Generate bracket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
