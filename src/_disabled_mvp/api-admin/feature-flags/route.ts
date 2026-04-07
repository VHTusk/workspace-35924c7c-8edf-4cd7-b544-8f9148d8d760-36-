/**
 * Admin Feature Flags API
 * GET: List all feature flags
 * POST: Create a new feature flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlags, createFeatureFlag, initializeDefaultFeatureFlags, getFeatureFlagStats } from '@/lib/feature-flags';
import { validateAdminSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate admin session
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = await getFeatureFlagStats();
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    if (action === 'init') {
      await initializeDefaultFeatureFlags();
      return NextResponse.json({
        success: true,
        message: 'Default feature flags initialized',
      });
    }

    const flags = await getFeatureFlags();

    return NextResponse.json({
      success: true,
      data: flags,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin session
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { key, description, enabled, rolloutPercentage } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Feature flag key is required' },
        { status: 400 }
      );
    }

    // Validate key format (lowercase, underscores only)
    if (!/^[a-z_]+$/.test(key)) {
      return NextResponse.json(
        { success: false, error: 'Key must be lowercase letters and underscores only' },
        { status: 400 }
      );
    }

    // Validate rollout percentage
    if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) {
      return NextResponse.json(
        { success: false, error: 'Rollout percentage must be between 0 and 100' },
        { status: 400 }
      );
    }

    const flag = await createFeatureFlag(
      key,
      description,
      enabled ?? false,
      rolloutPercentage ?? 0
    );

    return NextResponse.json({
      success: true,
      data: flag,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error creating feature flag:', error);
    
    // Check for unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Feature flag with this key already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create feature flag' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Validate admin session
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { key, enabled, rolloutPercentage, description } = body;

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Feature flag key is required' },
        { status: 400 }
      );
    }

    // Validate rollout percentage if provided
    if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) {
      return NextResponse.json(
        { success: false, error: 'Rollout percentage must be between 0 and 100' },
        { status: 400 }
      );
    }

    const { updateFeatureFlag } = await import('@/lib/feature-flags');
    
    const updateData: {
      enabled?: boolean;
      rolloutPercentage?: number;
      description?: string;
    } = {};
    
    if (enabled !== undefined) updateData.enabled = enabled;
    if (rolloutPercentage !== undefined) updateData.rolloutPercentage = rolloutPercentage;
    if (description !== undefined) updateData.description = description;

    const flag = await updateFeatureFlag(key, updateData);

    if (!flag) {
      return NextResponse.json(
        { success: false, error: 'Feature flag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: flag,
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update feature flag' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Validate admin session
    const admin = await validateAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Feature flag key is required' },
        { status: 400 }
      );
    }

    const { deleteFeatureFlag } = await import('@/lib/feature-flags');
    const deleted = await deleteFeatureFlag(key);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Feature flag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Feature flag deleted successfully',
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete feature flag' },
      { status: 500 }
    );
  }
}
