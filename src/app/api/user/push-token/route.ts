/**
 * User Push Token API
 * POST: Register device token
 * DELETE: Unregister device token
 * GET: Get user's devices
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerDeviceToken, unregisterDeviceToken, getUserDevices } from '@/lib/push-notifications';
import { getSessionUser } from '@/lib/session-helpers';

export async function POST(request: NextRequest) {
  try {
    const authResult = await getSessionUser(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const body = await request.json();
    const { token, platform } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Device token is required' },
        { status: 400 }
      );
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform. Must be ios, android, or web' },
        { status: 400 }
      );
    }

    const result = await registerDeviceToken(authResult.userId, token, platform);

    return NextResponse.json({
      success: result.success,
      data: { deviceId: result.deviceRecordId ?? null },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register device token' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getSessionUser(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Device token is required' },
        { status: 400 }
      );
    }

    const success = await unregisterDeviceToken(token);

    return NextResponse.json({
      success,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error unregistering device token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unregister device token' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getSessionUser(request);
    if (!authResult.success) {
      return authResult.error;
    }

    const devices = await getUserDevices(authResult.userId);

    return NextResponse.json({
      success: true,
      data: devices,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting user devices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get user devices' },
      { status: 500 }
    );
  }
}
