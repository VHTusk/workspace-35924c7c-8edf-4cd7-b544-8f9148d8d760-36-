import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrgSession } from '@/lib/auth/org-session';
import { generateSeedings, previewSeedings, saveSeedings, SeedingOptions } from '@/lib/seeding';

/**
 * GET /api/admin/tournaments/[id]/seeding
 * Preview tournament seeding before generating bracket
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        bracketFormat: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const method = (searchParams.get('method') || 'ELO') as SeedingOptions['method'];
    const antiCollision = searchParams.get('antiCollision') === 'true';
    const topSeedProtection = searchParams.get('topSeedProtection') === 'true';
    const randomThreshold = parseInt(searchParams.get('randomThreshold') || '8');

    const options: SeedingOptions = {
      method,
      antiCollision,
      topSeedProtection,
      randomThreshold,
    };

    const result = await previewSeedings(id, options);

    // Get player names for the preview
    const playerIds = result.assignments.map(a => a.userId);
    const players = await db.user.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const playerMap = Object.fromEntries(
      players.map(p => [p.id, `${p.firstName} ${p.lastName}`])
    );

    // Enrich the preview with player names
    const enrichedAssignments = result.assignments.map(a => ({
      ...a,
      playerName: playerMap[a.userId] || 'Unknown',
    }));

    const enrichedBracketPreview = result.bracketPreview.map(m => ({
      ...m,
      playerAName: m.playerA === 'BYE' ? 'BYE' : 
        (playerMap[result.assignments.find(a => a.seed === m.seedA)?.userId || ''] || 'Unknown'),
      playerBName: m.playerB === 'BYE' ? 'BYE' : 
        (playerMap[result.assignments.find(a => a.seed === m.seedB)?.userId || ''] || 'Unknown'),
    }));

    return NextResponse.json({
      seeding: {
        method,
        options,
        assignments: enrichedAssignments,
        bracketPreview: enrichedBracketPreview,
        playerCount: result.assignments.length,
      },
    });
  } catch (error) {
    console.error('Error previewing seeding:', error);
    return NextResponse.json({ error: 'Failed to preview seeding' }, { status: 500 });
  }
}

/**
 * POST /api/admin/tournaments/[id]/seeding
 * Apply seeding to existing bracket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getOrgSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { method, antiCollision, topSeedProtection, randomThreshold } = body;

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        bracket: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.orgId !== session.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!tournament.bracket) {
      return NextResponse.json({ error: 'Bracket not generated yet' }, { status: 400 });
    }

    const options: SeedingOptions = {
      method: method || 'ELO',
      antiCollision: antiCollision ?? true,
      topSeedProtection: topSeedProtection ?? true,
      randomThreshold: randomThreshold || 8,
    };

    const assignments = await generateSeedings(id, options);
    await saveSeedings(id, assignments);

    return NextResponse.json({
      success: true,
      message: `Seeding applied: ${assignments.length} players seeded using ${method} method`,
      seedingMethod: method,
      playerCount: assignments.length,
    });
  } catch (error) {
    console.error('Error applying seeding:', error);
    return NextResponse.json({ error: 'Failed to apply seeding' }, { status: 500 });
  }
}
