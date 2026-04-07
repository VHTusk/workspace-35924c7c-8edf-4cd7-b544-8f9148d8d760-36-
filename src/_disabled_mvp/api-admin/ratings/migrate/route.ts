/**
 * API Route: POST /api/admin/ratings/migrate
 * 
 * v3.39.0 Global Rating System - Migration Endpoint
 * Migrates existing hiddenElo to globalElo for a sport
 * 
 * Should be run once per sport during v3.39.0 deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { migrateToGlobalElo } from '@/lib/global-rating';
import { SportType } from '@prisma/client';
import { validateSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sport, confirm } = body;

    // Validation
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Valid sport required (CORNHOLE or DARTS)' },
        { status: 400 }
      );
    }

    if (confirm !== 'MIGRATE_GLOBAL_ELO') {
      return NextResponse.json(
        { error: 'Confirmation string required: "MIGRATE_GLOBAL_ELO"' },
        { status: 400 }
      );
    }

    // Check current migration status
    const playersWithDefaultElo = await db.user.count({
      where: {
        sport: sport as SportType,
        globalElo: 1500,
        hiddenElo: { not: 1500 },
      },
    });

    if (playersWithDefaultElo === 0) {
      return NextResponse.json({
        success: true,
        message: 'No players need migration - all players already have correct globalElo',
        migratedCount: 0,
      });
    }

    // Perform migration
    const result = await migrateToGlobalElo(sport as SportType);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Migration failed' },
        { status: 500 }
      );
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        sport: sport as SportType,
        action: 'ADMIN_OVERRIDE',
        actorId: session.userId,
        actorRole: 'ADMIN',
        targetType: 'system',
        targetId: 'global_rating_migration',
        reason: `Migrated ${result.migratedCount} players from hiddenElo to globalElo`,
        metadata: JSON.stringify({ sport, migratedCount: result.migratedCount }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Migration complete for ${sport}`,
      data: {
        sport,
        migratedCount: result.migratedCount,
        timestamp: new Date().toISOString(),
        performedBy: session.userId,
      },
    });
  } catch (error) {
    console.error('Error in rating migration:', error);
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/ratings/migrate
 * Returns migration status for both sports
 */
export async function GET(request: NextRequest) {
  try {
    // Validate admin session
    const session = await validateSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const [cornholeStats, dartsStats] = await Promise.all([
      getMigrationStats('CORNHOLE'),
      getMigrationStats('DARTS'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        CORNHOLE: cornholeStats,
        DARTS: dartsStats,
      },
    });
  } catch (error) {
    console.error('Error getting migration status:', error);
    return NextResponse.json(
      { error: 'Failed to get migration status' },
      { status: 500 }
    );
  }
}

async function getMigrationStats(sport: SportType) {
  const [total, pending, completed, provisional] = await Promise.all([
    db.user.count({ where: { sport } }),
    db.user.count({
      where: {
        sport,
        globalElo: 1500,
        hiddenElo: { not: 1500 },
      },
    }),
    db.user.count({
      where: {
        sport,
        OR: [
          { hiddenElo: 1500 },
          { globalElo: { not: 1500 } },
        ],
      },
    }),
    db.user.count({
      where: {
        sport,
        isProvisional: true,
      },
    }),
  ]);

  return {
    totalPlayers: total,
    pendingMigration: pending,
    alreadyMigrated: total - pending,
    provisionalPlayers: provisional,
    migrationNeeded: pending > 0,
  };
}
