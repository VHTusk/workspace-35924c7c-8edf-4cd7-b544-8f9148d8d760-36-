import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeWatcher } from '@/lib/tournament-watcher';

/**
 * POST /api/public/watchers/[id]/unsubscribe
 * Unsubscribe from tournament updates
 * 
 * Body: { reason? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watcherId } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const result = await unsubscribeWatcher(watcherId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed from tournament updates.',
    });
  } catch (error) {
    console.error('Unsubscribe watcher error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/public/watchers/[id]/unsubscribe
 * Unsubscribe via link (from emails)
 * 
 * Query params: token (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watcherId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    const result = await unsubscribeWatcher(watcherId, token || undefined);

    if (!result.success) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui; max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1 class="error">Unsubscribe Failed</h1>
          <p>${result.error}</p>
          <p><a href="/">Return to VALORHIVE</a></p>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui; max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #16a34a; }
          .btn { display: inline-block; background: #6b7280; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1 class="success">✓ Unsubscribed</h1>
        <p>You will no longer receive updates about this tournament.</p>
        <a href="/" class="btn">Continue to VALORHIVE</a>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Unsubscribe watcher error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
