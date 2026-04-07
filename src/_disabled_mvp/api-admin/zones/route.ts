/**
 * Zone Management API (v3.46.0)
 * 
 * GET: List zones (optionally filtered by sector)
 * POST: Create new zone
 * PATCH: Update zone (move states, change sector)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AdminRole, SportType } from '@prisma/client';
import { z } from 'zod';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { validateBody, validationErrorResponse } from '@/lib/validation';

// Zone creation validation schema
const createZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required').max(200, 'Zone name too long'),
  code: z.string().min(1, 'Zone code is required').max(20, 'Zone code too long'),
  sectorId: z.string().cuid({ message: 'Invalid sector ID format' }),
  states: z.array(z.string().max(50, 'State code too long')).min(1, 'At least one state is required'),
});

// Zone update validation schema
const updateZoneSchema = z.object({
  zoneId: z.string().cuid({ message: 'Invalid zone ID format' }),
  states: z.array(z.string().max(50, 'State code too long')).optional(),
  sectorId: z.string().cuid({ message: 'Invalid sector ID format' }).optional(),
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

// GET /api/admin/zones
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId');

    const where = sectorId ? { sectorId } : {};

    const zones = await db.zone.findMany({
      where,
      include: {
        sector: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            admins: { where: { isActive: true } },
          },
        },
      },
      orderBy: [{ sector: { name: 'asc' } }, { code: 'asc' }],
    });

    return NextResponse.json({
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        code: z.code,
        sector: z.sector,
        states: JSON.parse(z.states),
        isActive: z.isActive,
        createdAt: z.createdAt,
        adminCount: z._count.admins,
      })),
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/zones - Create new zone
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    // Check Super Admin or Sport Admin with canManageSectors
    const assignment = await db.adminAssignment.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        OR: [
          { adminRole: AdminRole.SUPER_ADMIN },
          { adminRole: AdminRole.SPORT_ADMIN },
        ],
      },
      include: { permissions: true },
    });

    if (!assignment || 
        (assignment.adminRole !== AdminRole.SUPER_ADMIN && 
         !assignment.permissions?.canManageSectors)) {
      return NextResponse.json(
        { error: 'No permission to create zones' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body with Zod
    const validation = validateBody(createZoneSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    
    const { name, code, sectorId, states } = validation.data;

    // Validate sector exists
    const sector = await db.sector.findUnique({
      where: { id: sectorId },
    });

    if (!sector) {
      return NextResponse.json({ error: 'Sector not found' }, { status: 404 });
    }

    const zone = await db.zone.create({
      data: {
        name,
        code: code.toUpperCase(),
        sectorId,
        states: JSON.stringify(states),
        createdById: user.id,
      },
      include: { sector: true },
    });

    // Log boundary change
    await db.boundaryChangeLog.create({
      data: {
        changedById: user.id,
        changeType: 'CREATE_ZONE',
        description: `Created zone: ${name} (${code}) in sector ${sector.name}`,
        reason: 'New zone creation',
        beforeState: JSON.stringify({}),
        afterState: JSON.stringify(zone),
        affectedAdmins: JSON.stringify([]),
      },
    });

    return NextResponse.json({
      success: true,
      zone: {
        id: zone.id,
        name: zone.name,
        code: zone.code,
        sector: zone.sector,
        states: JSON.parse(zone.states),
        isActive: zone.isActive,
      },
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/zones - Update zone (move states, change sector)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    // Check Super Admin only for boundary changes
    const superAdmin = await db.adminAssignment.findFirst({
      where: {
        userId: user.id,
        adminRole: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    if (!superAdmin) {
      return NextResponse.json(
        { error: 'Only Super Admin can modify zone boundaries' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body with Zod
    const validation = validateBody(updateZoneSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    
    const { zoneId, states, sectorId, reason } = validation.data;

    const zone = await db.zone.findUnique({
      where: { id: zoneId },
      include: { sector: true },
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const oldState = {
      states: JSON.parse(zone.states),
      sectorId: zone.sectorId,
    };

    const updateData: Record<string, unknown> = {};
    if (states) updateData.states = JSON.stringify(states);
    if (sectorId) updateData.sectorId = sectorId;

    const updatedZone = await db.zone.update({
      where: { id: zoneId },
      data: updateData,
      include: { sector: true },
    });

    // Determine change type
    let changeType = 'MOVE_STATE';
    if (sectorId && sectorId !== zone.sectorId) {
      changeType = 'MOVE_ZONE';
    }

    // Find affected admins
    const affectedAdmins = await db.adminAssignment.findMany({
      where: {
        OR: [
          { zoneId },
          { zoneId: updatedZone.id },
        ],
      },
      select: { userId: true },
    });

    // Log boundary change
    await db.boundaryChangeLog.create({
      data: {
        changedById: user.id,
        changeType,
        description: `Modified zone: ${zone.name} (${zone.code})`,
        reason: reason || 'Boundary adjustment',
        beforeState: JSON.stringify(oldState),
        afterState: JSON.stringify({
          states: JSON.parse(updatedZone.states),
          sectorId: updatedZone.sectorId,
        }),
        affectedAdmins: JSON.stringify(affectedAdmins.map((a) => a.userId)),
      },
    });

    // Notify affected admins
    for (const admin of affectedAdmins) {
      await db.notification.create({
        data: {
          userId: admin.userId,
          sport: SportType.CORNHOLE,
          type: 'TOURNAMENT_CANCELLED',
          title: 'Zone Boundary Changed',
          message: `Your zone ${zone.name} has been modified. Check your admin dashboard.`,
          link: '/admin/dashboard',
        },
      });
    }

    return NextResponse.json({
      success: true,
      zone: {
        id: updatedZone.id,
        name: updatedZone.name,
        code: updatedZone.code,
        sector: updatedZone.sector,
        states: JSON.parse(updatedZone.states),
      },
      affectedAdmins: affectedAdmins.length,
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
