import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { Role, SportType, AuditAction } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';

/**
 * Venue-Day Escalation API (v3.52.0)
 * 
 * Handles emergency director escalation for venue-day scenarios.
 * This is a MANUAL trigger for State Admins+ when a director is not responding
 * during a live tournament (not auto-cron based).
 */

// Trigger venue escalation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const auth = await getAuthenticatedAdmin(cookieStore);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    // Only STATE_ADMIN and above can trigger venue escalation
    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ 
        error: 'Only State Admins and above can trigger venue escalation' 
      }, { status: 403 });
    }

    const { id: tournamentId } = await params;
    const body = await request.json();
    const { action, reason, replacementDirectorId } = body;

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        sport: true,
        status: true,
        directorName: true,
        directorPhone: true,
        venueEscalationActive: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check tournament is in progress or venue-day relevant status
    const activeStatuses = ['REGISTRATION_OPEN', 'BRACKET_GENERATED', 'IN_PROGRESS', 'PAUSED'];
    if (!activeStatuses.includes(tournament.status)) {
      return NextResponse.json({ 
        error: 'Venue escalation only available for active tournaments' 
      }, { status: 400 });
    }

    switch (action) {
      case 'trigger': {
        if (!reason || reason.trim().length < 10) {
          return NextResponse.json({ 
            error: 'Reason must be at least 10 characters' 
          }, { status: 400 });
        }

        if (tournament.venueEscalationActive) {
          return NextResponse.json({ 
            error: 'Venue escalation already active for this tournament' 
          }, { status: 400 });
        }

        // Trigger escalation
        const updated = await db.tournament.update({
          where: { id: tournamentId },
          data: {
            venueEscalationActive: true,
            venueEscalationTriggeredAt: new Date(),
            venueEscalationTriggeredById: user.id,
            venueEscalationReason: reason.trim(),
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            sport: tournament.sport as SportType,
            action: AuditAction.ADMIN_OVERRIDE,
            actorId: user.id,
            actorRole: user.role as Role,
            targetType: 'Tournament',
            targetId: tournamentId,
            tournamentId,
            metadata: JSON.stringify({
              action: 'VENUE_ESCALATION_TRIGGERED',
              reason: reason.trim(),
              originalDirector: tournament.directorName,
            }),
          },
        });

        return NextResponse.json({
          success: true,
          escalation: {
            triggeredAt: updated.venueEscalationTriggeredAt,
            reason: updated.venueEscalationReason,
            triggeredBy: user.id,
          },
        });
      }

      case 'resolve': {
        if (!tournament.venueEscalationActive) {
          return NextResponse.json({ 
            error: 'No active escalation to resolve' 
          }, { status: 400 });
        }

        // Resolve escalation
        await db.tournament.update({
          where: { id: tournamentId },
          data: {
            venueEscalationActive: false,
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            sport: tournament.sport as SportType,
            action: AuditAction.ADMIN_OVERRIDE,
            actorId: user.id,
            actorRole: user.role as Role,
            targetType: 'Tournament',
            targetId: tournamentId,
            tournamentId,
            metadata: JSON.stringify({
              action: 'VENUE_ESCALATION_RESOLVED',
              resolvedBy: user.id,
            }),
          },
        });

        return NextResponse.json({ success: true });
      }

      case 'assign-replacement': {
        if (!replacementDirectorId) {
          return NextResponse.json({ 
            error: 'Replacement director ID required' 
          }, { status: 400 });
        }

        // Get replacement admin details
        const replacement = await db.user.findUnique({
          where: { id: replacementDirectorId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        });

        if (!replacement) {
          return NextResponse.json({ 
            error: 'Replacement director not found' 
          }, { status: 404 });
        }

        // Assign as new director
        const updated = await db.tournament.update({
          where: { id: tournamentId },
          data: {
            directorName: `${replacement.firstName} ${replacement.lastName}`,
            directorPhone: replacement.phone,
            directorEmail: replacement.email,
            venueEscalationActive: false,
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            sport: tournament.sport as SportType,
            action: AuditAction.ADMIN_OVERRIDE,
            actorId: user.id,
            actorRole: user.role as Role,
            targetType: 'Tournament',
            targetId: tournamentId,
            tournamentId,
            metadata: JSON.stringify({
              action: 'REPLACEMENT_DIRECTOR_ASSIGNED',
              replacementId: replacement.id,
              replacementName: `${replacement.firstName} ${replacement.lastName}`,
              reason: reason || 'Venue escalation replacement',
            }),
          },
        });

        return NextResponse.json({
          success: true,
          director: {
            name: updated.directorName,
            phone: updated.directorPhone,
            email: updated.directorEmail,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Venue escalation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get venue escalation status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const auth = await getAuthenticatedAdmin(cookieStore);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    const { id: tournamentId } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        name: true,
        status: true,
        directorName: true,
        directorPhone: true,
        directorEmail: true,
        venueEscalationActive: true,
        venueEscalationTriggeredAt: true,
        venueEscalationReason: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({
      escalation: tournament.venueEscalationActive ? {
        active: true,
        triggeredAt: tournament.venueEscalationTriggeredAt,
        reason: tournament.venueEscalationReason,
        director: {
          name: tournament.directorName,
          phone: tournament.directorPhone,
          email: tournament.directorEmail,
        },
      } : null,
    });
  } catch (error) {
    console.error('Get venue escalation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
