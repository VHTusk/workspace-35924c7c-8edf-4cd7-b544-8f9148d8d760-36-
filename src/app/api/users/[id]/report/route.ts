/**
 * User Report API Endpoint
 * 
 * POST /api/users/[id]/report
 * Allows authenticated users to report abusive players
 * 
 * Uses the ContentReport model to store reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/session';
import { reportContent } from '@/lib/content-moderation';
import { db } from '@/lib/db';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/users/[id]/report - Submit a report against a user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authenticated user
    const reporterId = await getAuthenticatedUserId();
    
    if (!reporterId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: reportedUserId } = await params;

    // Validate the reported user exists
    const reportedUser = await db.user.findUnique({
      where: { id: reportedUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sport: true,
      },
    });

    if (!reportedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-reporting
    if (reporterId === reportedUserId) {
      return NextResponse.json(
        { success: false, error: 'You cannot report yourself' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason, description, sport } = body;

    // Validate required fields
    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Report reason is required' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: 'Description must be at least 20 characters' },
        { status: 400 }
      );
    }

    // Validate reason is one of the allowed categories
    const validReasons = ['harassment', 'spam', 'cheating', 'inappropriate_content', 'impersonation', 'other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: 'Invalid report category' },
        { status: 400 }
      );
    }

    // Check for duplicate report (same reporter, same user, same reason, within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingReport = await db.contentReport.findFirst({
      where: {
        reporterId,
        reportedUserId,
        reason,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You have already submitted a similar report in the last 24 hours',
          reportId: existingReport.id,
        },
        { status: 429 }
      );
    }

    // Create the report using the content moderation service
    const result = await reportContent({
      reporterId,
      contentType: 'player_name',
      contentId: reportedUserId,
      reason,
      description: description.trim(),
      reportedUserId,
      contentSnapshot: JSON.stringify({
        userName: `${reportedUser.firstName} ${reportedUser.lastName}`,
        userSport: reportedUser.sport,
        reportCategory: reason,
      }),
    });

    // Log the report submission
    console.log('[UserReport] Report submitted:', {
      reporterId,
      reportedUserId,
      reason,
      reportId: result.reportId,
      autoFlagged: result.autoFlagged,
    });

    return NextResponse.json({
      success: true,
      data: {
        reportId: result.reportId,
        autoFlagged: result.autoFlagged,
        message: 'Report submitted successfully. Our team will review it shortly.',
      },
    });
  } catch (error) {
    console.error('[UserReport] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to submit report' 
      },
      { status: 500 }
    );
  }
}

// GET /api/users/[id]/report - Check if user can report (rate limit check)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authenticated user
    const reporterId = await getAuthenticatedUserId();
    
    if (!reporterId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: reportedUserId } = await params;

    // Check for existing reports in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReports = await db.contentReport.findMany({
      where: {
        reporterId,
        reportedUserId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        reason: true,
        createdAt: true,
      },
    });

    // Calculate if user can report
    const canReport = reporterId !== reportedUserId && recentReports.length === 0;

    return NextResponse.json({
      success: true,
      data: {
        canReport,
        recentReportsCount: recentReports.length,
        recentReports: recentReports.map(r => ({
          id: r.id,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
        })),
        cooldownEndsAt: recentReports.length > 0 
          ? new Date(recentReports[0].createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : null,
      },
    });
  } catch (error) {
    console.error('[UserReport] GET Error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to check report status' },
      { status: 500 }
    );
  }
}
