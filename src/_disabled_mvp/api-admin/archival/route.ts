/**
 * Data Archival API - Admin Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  runAllCleanupTasks, 
  getRetentionStats,
  RETENTION_PERIODS 
} from '@/lib/data-retention';
import { addVersionHeaders } from '@/lib/api-versioning';

// GET /api/admin/archival - Get retention stats and policies
export async function GET() {
  try {
    const stats = await getRetentionStats();
    
    const response = NextResponse.json({
      success: true,
      data: {
        stats,
        policies: RETENTION_PERIODS,
      },
    });
    
    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Failed to get retention stats:', error);
    return NextResponse.json({ error: 'Failed to get retention stats' }, { status: 500 });
  }
}

// POST /api/admin/archival - Run cleanup tasks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun !== false; // Default to dry run for safety

    const results = await runAllCleanupTasks(dryRun);

    const response = NextResponse.json({
      success: true,
      data: {
        dryRun,
        results,
      },
    });

    addVersionHeaders(response);
    return response;
  } catch (error) {
    console.error('Failed to run cleanup tasks:', error);
    return NextResponse.json({ error: 'Failed to run cleanup tasks' }, { status: 500 });
  }
}
