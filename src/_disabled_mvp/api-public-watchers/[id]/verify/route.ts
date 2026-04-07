import { NextRequest, NextResponse } from 'next/server';
import { verifyWatcher } from '@/lib/tournament-watcher';

/**
 * POST /api/public/watchers/[id]/verify
 * Verify a watcher subscription with token/OTP
 * 
 * Body: { token }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watcherId } = await params;
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const result = await verifyWatcher(watcherId, token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription verified! You will now receive tournament updates.',
      watcherId: result.watcherId,
    });
  } catch (error) {
    console.error('Verify watcher error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/public/watchers/[id]/verify
 * Verify via link (email verification link)
 * 
 * Query params: token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: watcherId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const result = await verifyWatcher(watcherId, token);

    if (!result.success) {
      // Return HTML page for better UX
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Failed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui; max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
            .error { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1 class="error">Verification Failed</h1>
          <p>${result.error}</p>
          <p><a href="/">Return to VALORHIVE</a></p>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Return success HTML page
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Subscription Verified</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui; max-width: 500px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #16a34a; }
          .btn { display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1 class="success">✓ Subscription Verified!</h1>
        <p>You will now receive updates about this tournament.</p>
        <a href="/" class="btn">Continue to VALORHIVE</a>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Verify watcher error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
