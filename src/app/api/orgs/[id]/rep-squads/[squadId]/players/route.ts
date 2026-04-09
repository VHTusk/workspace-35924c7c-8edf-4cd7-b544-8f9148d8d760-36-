// API: Rep Squad Players Management
// GET /api/orgs/[id]/rep-squads/[squadId]/players - List players in squad
// POST /api/orgs/[id]/rep-squads/[squadId]/players - Add player to squad
// DELETE /api/orgs/[id]/rep-squads/[squadId]/players - Remove player from squad

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// GET - List players in squad
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; squadId: string }> }
) {
  try {
    const { id: orgId, squadId } = await params;

    // Verify squad belongs to this org
    const squad = await db.repSquad.findFirst({
      where: { id: squadId, orgId },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const players = await db.repPlayer.findMany({
      where: { squadId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            hiddenElo: true,
            visiblePoints: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Get squad players error:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

// POST - Add player to squad (with contract validation)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; squadId: string }> }
) {
  try {
    const { id: orgId, squadId } = await params;
    const body = await req.json();
    const { playerId, role, playerType } = body;

    // Validate session
    const session = await validateOrgSession(
      req.cookies.get('session_token')?.value || ''
    );
    if (!session || session.org.id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify squad belongs to this org
    const squad = await db.repSquad.findFirst({
      where: { id: squadId, orgId, status: 'ACTIVE' },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found or inactive' }, { status: 404 });
    }

    // Check if player already in this squad
    const existingPlayer = await db.repPlayer.findUnique({
      where: { squadId_userId: { squadId, userId: playerId } },
    });

    if (existingPlayer && existingPlayer.status === 'ACTIVE') {
      return NextResponse.json(
        { error: 'Player is already in this squad' },
        { status: 400 }
      );
    }

    // ============================================
    // CONTRACT ENFORCEMENT (CRITICAL)
    // ============================================
    // Every player in INTER corporate mode MUST have an ACTIVE contract
    // This applies to BOTH employees and external players

    const now = new Date();
    const currentYear = now.getFullYear();
    const yearEnd = new Date(currentYear, 11, 31); // Dec 31 of current year

    // Check for active contract
    const activeContract = await db.playerContract.findFirst({
      where: {
        playerId,
        organizationId: orgId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (!activeContract) {
      // No active contract - check if there's a pending one
      const pendingContract = await db.playerContract.findFirst({
        where: {
          playerId,
          organizationId: orgId,
          status: 'PENDING',
        },
      });

      if (pendingContract) {
        return NextResponse.json(
          { 
            error: 'Player has a pending contract that must be verified before adding to squad',
            errorCode: 'CONTRACT_PENDING',
            contractId: pendingContract.id,
          },
          { status: 400 }
        );
      }

      // No contract at all - need to create one
      // Auto-create an annual contract for the player
      try {
        await db.playerContract.create({
          data: {
            playerId,
            organizationId: orgId,
            contractTitle: `${currentYear} Annual Representation Contract`,
            contractType: 'annual',
            contractTerms: 'Annual representation contract for inter-corporate tournaments',
            startDate: now,
            endDate: yearEnd,
            status: 'PENDING', // Requires admin verification
            createdById: session.user?.id,
          },
        });

        return NextResponse.json(
          {
            error: 'Player requires a contract before being added to squad. A pending contract has been created and requires verification.',
            errorCode: 'CONTRACT_REQUIRED',
          },
          { status: 400 }
        );
      } catch (contractError) {
        console.error('Contract creation error:', contractError);
        return NextResponse.json(
          { error: 'Failed to create contract for player' },
          { status: 500 }
        );
      }
    }

    // Validate contract covers tournament participation
    // Contract must end on Dec 31
    if (activeContract.endDate.getFullYear() !== currentYear ||
        activeContract.endDate.getMonth() !== 11 ||
        activeContract.endDate.getDate() !== 31) {
      // Log warning but allow - contract is still valid
      console.warn(`Contract for player ${playerId} does not end on Dec 31`);
    }

    // ============================================
    // ADD PLAYER TO SQUAD
    // ============================================

    const playerData = {
      squadId,
      userId: playerId,
      playerType: playerType || 'CONTRACTED', // EMPLOYEE_REP or CONTRACTED
      status: 'ACTIVE' as const,
      role: role || 'PLAYER',
      contractId: activeContract.id,
      contractStartDate: activeContract.startDate,
      contractEndDate: activeContract.endDate,
    };

    // If player was previously removed, update their status instead of creating new
    if (existingPlayer && existingPlayer.status !== 'ACTIVE') {
      const updatedPlayer = await db.repPlayer.update({
        where: { id: existingPlayer.id },
        data: {
          ...playerData,
          joinedAt: new Date(),
          leftAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return NextResponse.json({ 
        player: updatedPlayer,
        message: 'Player re-added to squad successfully' 
      });
    }

    // Create new player entry
    const newPlayer = await db.repPlayer.create({
      data: playerData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      player: newPlayer,
      message: 'Player added to squad successfully' 
    }, { status: 201 });
  } catch (error) {
    console.error('Add player to squad error:', error);
    return NextResponse.json({ error: 'Failed to add player to squad' }, { status: 500 });
  }
}

// DELETE - Remove player from squad
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; squadId: string }> }
) {
  try {
    const { id: orgId, squadId } = await params;
    const body = await req.json();
    const { playerId } = body;

    // Verify squad belongs to this org
    const squad = await db.repSquad.findFirst({
      where: { id: squadId, orgId },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Find and update player status
    const player = await db.repPlayer.findUnique({
      where: { squadId_userId: { squadId, userId: playerId } },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found in squad' }, { status: 404 });
    }

    await db.repPlayer.update({
      where: { id: player.id },
      data: {
        status: 'INACTIVE',
        leftAt: new Date(),
      },
    });

    return NextResponse.json({ message: 'Player removed from squad' });
  } catch (error) {
    console.error('Remove player from squad error:', error);
    return NextResponse.json({ error: 'Failed to remove player' }, { status: 500 });
  }
}
