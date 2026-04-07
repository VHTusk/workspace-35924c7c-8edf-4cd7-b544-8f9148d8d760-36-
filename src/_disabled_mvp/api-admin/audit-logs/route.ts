import { NextRequest, NextResponse } from 'next/server';
import { Role, AuditAction, SportType } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { queryAuditLogs } from '@/lib/audit-logger';
import { safeParseInt } from '@/lib/validation';

// List audit logs with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user } = auth;

    // Only ADMIN can view audit logs
    if (user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Only ADMIN can view audit logs' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse filters
    const eventType = searchParams.get('eventType') as AuditAction | null;
    const actorId = searchParams.get('userId') || searchParams.get('actorId') || null;
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    const tournamentId = searchParams.get('tournamentId');
    const sport = searchParams.get('sport') as SportType | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    
    const page = safeParseInt(searchParams.get('page'), 1, 1, 1000);
    const limit = safeParseInt(searchParams.get('limit'), 50, 1, 100);

    // Build filters
    const filters = {
      eventType: eventType || undefined,
      actorId: actorId || undefined,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      tournamentId: tournamentId || undefined,
      sport: sport || undefined,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
    };

    // Query audit logs using the helper
    const result = await queryAuditLogs(filters, { page, limit });

    return NextResponse.json({
      logs: result.logs.map((log) => ({
        id: log.id,
        sport: log.sport,
        action: log.action,
        actor: log.actor ? {
          id: log.actor.id,
          name: `${log.actor.firstName} ${log.actor.lastName}`,
          email: log.actor.email,
          role: log.actor.role,
        } : null,
        actorRole: log.actorRole,
        targetType: log.targetType,
        targetId: log.targetId,
        tournamentId: log.tournamentId,
        reason: log.reason,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Admin audit logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
