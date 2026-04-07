/**
 * Content Reports API - Admin Management
 * 
 * GET: List reports with filtering (status, contentType, date range)
 * PUT: Review/resolve a report
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPendingReports, 
  reviewReport, 
  getModerationStats 
} from '@/lib/content-moderation';
import { addVersionHeaders } from '@/lib/api-versioning';
import { ReportStatus } from '@prisma/client';
import { getAuthenticatedEntity } from '@/lib/auth';

// GET /api/admin/content-reports - List reports with filtering
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    // Return moderation stats
    if (action === 'stats') {
      const stats = await getModerationStats();
      const response = NextResponse.json({ success: true, data: stats });
      addVersionHeaders(response);
      return response;
    }

    // Parse filter parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const contentType = searchParams.get('contentType') || undefined;
    
    // Status filter
    let status: ReportStatus | undefined;
    const statusParam = searchParams.get('status');
    if (statusParam && Object.values(ReportStatus).includes(statusParam as ReportStatus)) {
      status = statusParam as ReportStatus;
    }

    // Date range filters
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    const startDateParam = searchParams.get('startDate');
    if (startDateParam) {
      const parsed = new Date(startDateParam);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed;
      }
    }
    
    const endDateParam = searchParams.get('endDate');
    if (endDateParam) {
      const parsed = new Date(endDateParam);
      if (!isNaN(parsed.getTime())) {
        endDate = parsed;
      }
    }

    // Get reports
    const { reports, total } = await getPendingReports({
      limit,
      offset,
      contentType,
      status,
      startDate,
      endDate,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < total;

    const response = NextResponse.json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          limit,
          offset,
          currentPage,
          totalPages,
          hasMore,
        },
        filters: {
          contentType: contentType || null,
          status: status || null,
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
        },
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Failed to get content reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get content reports' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/content-reports - Review/resolve a report
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user - API determines reviewer from auth, not client
    const auth = await getAuthenticatedEntity(request);
    if (!auth || auth.type !== 'user') {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { reportId, action, notes } = body;
    
    // Use authenticated user as reviewer
    const reviewerId = auth.user.id;

    // Validate required fields
    if (!reportId || !reviewerId || !action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: reportId, reviewerId, action' 
        },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ['dismiss', 'warning', 'content_removed', 'account_suspended'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid action. Must be one of: ${validActions.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Review the report
    const result = await reviewReport(reportId, reviewerId, action, notes);

    const response = NextResponse.json({
      success: true,
      data: {
        report: result.report,
        actionTaken: result.actionTaken,
      },
      message: `Report ${action === 'dismiss' ? 'dismissed' : 'resolved'} successfully`,
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Failed to review report:', error);
    
    if (error instanceof Error && error.message === 'Report not found') {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to review report' },
      { status: 500 }
    );
  }
}
