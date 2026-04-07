/**
 * Admin Availability API
 * 
 * GET: Fetch admin's availability entries for a date range
 * POST: Create or update availability entry
 * DELETE: Remove availability entry
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedAdmin } from "@/lib/auth";

// GET - Fetch availability entries for a date range
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await getAuthenticatedAdmin(request);
    if (!adminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Get admin assignment for the current admin
    const adminAssignment = await db.adminAssignment.findFirst({
      where: { userId: adminAuth.user.id },
    });

    if (!adminAssignment) {
      return NextResponse.json(
        { success: true, availability: [], assignments: [] }
      );
    }

    // Fetch availability entries
    const availability = await db.adminAvailability.findMany({
      where: {
        adminId: adminAssignment.id,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: "asc" },
    });

    // Fetch tournament assignments for this admin in the date range
    const assignments = await db.tournament.findMany({
      where: {
        staff: { some: { userId: adminAuth.user.id } },
        startDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        location: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      availability: availability.map((a) => ({
        ...a,
        date: a.date.toISOString(),
      })),
      assignments: assignments.map((t) => ({
        id: t.id,
        name: t.name,
        date: t.startDate?.toISOString() || new Date().toISOString(),
        location: t.location,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

// POST - Create or update availability entry
export async function POST(request: NextRequest) {
  try {
    const adminAuth = await getAuthenticatedAdmin(request);
    if (!adminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { date, isAvailable, notes, isRecurring, recurrencePattern } = body;

    if (!date) {
      return NextResponse.json(
        { error: "Date is required" },
        { status: 400 }
      );
    }

    // Get admin assignment for the current admin
    const adminAssignment = await db.adminAssignment.findFirst({
      where: { userId: adminAuth.user.id },
    });

    if (!adminAssignment) {
      return NextResponse.json(
        { error: "Admin assignment not found" },
        { status: 404 }
      );
    }

    const entryDate = new Date(date);

    // Upsert the availability entry
    const availability = await db.adminAvailability.upsert({
      where: {
        adminId_date: {
          adminId: adminAssignment.id,
          date: entryDate,
        },
      },
      update: {
        isAvailable: isAvailable ?? true,
        notes: notes || null,
        isRecurring: isRecurring ?? false,
        recurrencePattern: isRecurring ? recurrencePattern : null,
      },
      create: {
        adminId: adminAssignment.id,
        date: entryDate,
        isAvailable: isAvailable ?? true,
        notes: notes || null,
        isRecurring: isRecurring ?? false,
        recurrencePattern: isRecurring ? recurrencePattern : null,
      },
    });

    return NextResponse.json({
      success: true,
      availability: {
        ...availability,
        date: availability.date.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error saving availability:", error);
    return NextResponse.json(
      { error: "Failed to save availability" },
      { status: 500 }
    );
  }
}

// DELETE - Remove availability entry
export async function DELETE(request: NextRequest) {
  try {
    const adminAuth = await getAuthenticatedAdmin(request);
    if (!adminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Availability entry ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const adminAssignment = await db.adminAssignment.findFirst({
      where: { userId: adminAuth.user.id },
    });

    if (!adminAssignment) {
      return NextResponse.json(
        { error: "Admin assignment not found" },
        { status: 404 }
      );
    }

    const entry = await db.adminAvailability.findUnique({
      where: { id },
    });

    if (!entry || entry.adminId !== adminAssignment.id) {
      return NextResponse.json(
        { error: "Entry not found or unauthorized" },
        { status: 404 }
      );
    }

    await db.adminAvailability.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting availability:", error);
    return NextResponse.json(
      { error: "Failed to delete availability" },
      { status: 500 }
    );
  }
}
