/**
 * Admin Availability by Date API
 * 
 * GET: Fetch availability and assignments for a specific date
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';

// GET /api/admin/availability/[date] - Fetch availability and assignments for a specific date
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    const { date: dateParam } = await params;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const targetDate = new Date(dateParam);

    // Get the admin assignment for this user
    const adminAssignment = await db.adminAssignment.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        ...(session?.sport ? { sport: session.sport } : {}),
      },
    });

    if (!adminAssignment) {
      return NextResponse.json(
        { error: 'No active admin assignment found' },
        { status: 404 }
      );
    }

    // Fetch availability for this date
    const availability = await db.adminAvailability.findUnique({
      where: {
        adminId_date: {
          adminId: adminAssignment.id,
          date: targetDate,
        },
      },
    });

    // Fetch tournament assignments for this date
    const tournamentAssignments = await db.tournamentStaff.findMany({
      where: {
        userId: user.id,
        tournament: {
          AND: [
            { startDate: { lte: targetDate } },
            { endDate: { gte: targetDate } },
          ],
        },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            location: true,
            status: true,
            city: true,
            state: true,
            managerName: true,
            managerPhone: true,
          },
        },
      },
    });

    // Check for recurring availability
    const dayOfWeek = targetDate.getDay();
    const recurringAvailability = await db.adminAvailability.findFirst({
      where: {
        adminId: adminAssignment.id,
        isRecurring: true,
        recurrencePattern: 'weekly',
        // Check if there's a recurring entry for this day of week
        // We use a date range that would include this day
        date: {
          lte: targetDate,
        },
      },
    });

    // Check for biweekly pattern
    const biweeklyAvailability = await db.adminAvailability.findFirst({
      where: {
        adminId: adminAssignment.id,
        isRecurring: true,
        recurrencePattern: 'biweekly',
        date: {
          lte: targetDate,
        },
      },
    });

    // Calculate if biweekly applies
    let isBiweeklyAvailable = false;
    if (biweeklyAvailability) {
      const weeksDiff = Math.floor(
        (targetDate.getTime() - biweeklyAvailability.date.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      isBiweeklyAvailable = weeksDiff % 2 === 0 && biweeklyAvailability.isAvailable;
    }

    return NextResponse.json({
      date: dateParam,
      availability: availability
        ? {
            id: availability.id,
            isAvailable: availability.isAvailable,
            notes: availability.notes,
            isRecurring: availability.isRecurring,
            recurrencePattern: availability.recurrencePattern,
          }
        : null,
      recurringAvailability: recurringAvailability
        ? {
            isAvailable: recurringAvailability.isAvailable,
            pattern: 'weekly',
            dayOfWeek,
          }
        : null,
      biweeklyAvailability: biweeklyAvailability
        ? {
            isAvailable: isBiweeklyAvailable,
            pattern: 'biweekly',
          }
        : null,
      tournamentAssignments: tournamentAssignments.map((a) => ({
        id: a.tournament.id,
        name: a.tournament.name,
        startDate: a.tournament.startDate,
        endDate: a.tournament.endDate,
        location: a.tournament.location,
        city: a.tournament.city,
        state: a.tournament.state,
        status: a.tournament.status,
        role: a.role,
        manager: {
          name: a.tournament.managerName,
          phone: a.tournament.managerPhone,
        },
      })),
      adminAssignment: {
        id: adminAssignment.id,
        role: adminAssignment.adminRole,
        sport: adminAssignment.sport,
      },
    });
  } catch (error) {
    console.error('Error fetching admin availability for date:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
