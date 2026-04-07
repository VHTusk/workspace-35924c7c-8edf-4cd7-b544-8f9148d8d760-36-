import { NextRequest, NextResponse } from 'next/server';
import { exportUserData } from '@/lib/gdpr-compliance';
import { validatePlayerSession } from '@/lib/auth-utils';

/**
 * GET /api/player/gdpr/export
 * Export all user data (Data Portability - GDPR Art. 20)
 */
export async function GET(request: NextRequest) {
  try {
    // Validate player session
    const session = await validatePlayerSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_001' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json') as 'json' | 'csv';

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        { error: 'Invalid format. Use "json" or "csv"', code: 'VAL_001' },
        { status: 400 }
      );
    }

    const result = await exportUserData(session.userId, format);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: 'SRV_001' },
        { status: 500 }
      );
    }

    // Set appropriate headers for download
    const headers: Record<string, string> = {
      'Content-Disposition': `attachment; filename="valorhive-data-export-${session.userId}.${format}"`,
    };

    if (format === 'json') {
      headers['Content-Type'] = 'application/json';
      return NextResponse.json(result.data, { headers });
    } else {
      headers['Content-Type'] = 'text/csv';
      return new NextResponse(result.data, { headers });
    }
  } catch (error) {
    console.error('GDPR export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data', code: 'SRV_001' },
      { status: 500 }
    );
  }
}
