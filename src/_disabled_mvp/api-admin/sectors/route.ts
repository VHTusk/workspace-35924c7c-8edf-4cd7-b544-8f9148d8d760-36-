/**
 * Sector Management API (v3.46.0)
 * 
 * GET: List all sectors
 * POST: Create new sector (Super Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedDirector } from '@/lib/auth';
import { AdminRole } from '@prisma/client';

// GET /api/admin/sectors
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user } = auth;

    const sectors = await db.sector.findMany({
      include: {
        zones: {
          include: {
            _count: {
              select: {
                admins: { where: { isActive: true } },
              },
            },
          },
        },
        _count: {
          select: {
            admins: { where: { isActive: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      sectors: sectors.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        isActive: s.isActive,
        createdAt: s.createdAt,
        zones: s.zones.map((z) => ({
          id: z.id,
          name: z.name,
          code: z.code,
          states: JSON.parse(z.states),
          isActive: z.isActive,
          adminCount: z._count.admins,
        })),
        adminCount: s._count.admins,
      })),
    });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/sectors - Create new sector
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user } = auth;

    // Check Super Admin
    const superAdmin = await db.adminAssignment.findFirst({
      where: {
        userId: user.id,
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Only Super Admin can create sectors' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code' },
        { status: 400 }
      );
    }

    const sector = await db.sector.create({
      data: {
        name,
        code: code.toUpperCase(),
        createdById: user.id,
      },
    });

    // Log boundary change
    await db.boundaryChangeLog.create({
      data: {
        changedById: user.id,
        changeType: 'CREATE_SECTOR',
        description: `Created sector: ${name} (${code})`,
        reason: 'New sector creation',
        beforeState: JSON.stringify({}),
        afterState: JSON.stringify(sector),
        affectedAdmins: JSON.stringify([]),
      },
    });

    return NextResponse.json({
      success: true,
      sector,
    });
  } catch (error) {
    console.error('Error creating sector:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
