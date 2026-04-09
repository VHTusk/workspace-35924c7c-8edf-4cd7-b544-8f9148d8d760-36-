import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateOrgSession } from '@/lib/auth';

// DEMO MODE: Set to true to show demo subscriptions for testing
const DEMO_MODE = true;

// GET - Get all sports for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateOrgSession(
      request.cookies.get('session_token')?.value || ''
    );

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orgId } = await params;

    // Verify this org belongs to the session
    if (session.org?.id !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all sport activations for this org
    const orgSports = await db.organizationSport.findMany({
      where: { orgId },
      include: {
        entitlement: true,
      },
    });

    // All available sports
    const allSports = ['cornhole', 'darts', 'badminton', 'cricket', 'football', 'table-tennis'];

    // Check if we have any ACTIVE subscriptions from the database
    const hasActiveFromDb = orgSports.some(s => s.status === 'ACTIVE');

    // Build response with all sports, showing status
    const sportsData = allSports.map(sportId => {
      const sportEnum = sportId.toUpperCase().replace('-', '_');
      const activation = orgSports.find(s => s.sport === sportEnum as any);
      
      // If found in database with status, use it
      if (activation && activation.status === 'ACTIVE') {
        return {
          id: sportId,
          name: sportId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          status: activation.status,
          planType: activation.planType,
          activatedAt: activation.activatedAt?.toISOString(),
          expiresAt: activation.expiresAt?.toISOString(),
        };
      }

      // DEMO MODE: For testing, show Cornhole and Darts as subscribed
      if (DEMO_MODE && !hasActiveFromDb && (sportId === 'cornhole' || sportId === 'darts')) {
        const now = new Date();
        const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        const endDate = new Date(now.getTime() + 275 * 24 * 60 * 60 * 1000); // ~9 months from now
        
        return {
          id: sportId,
          name: sportId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          status: 'ACTIVE',
          planType: 'PRO',
          activatedAt: startDate.toISOString(),
          expiresAt: endDate.toISOString(),
        };
      }

      // Sport not activated
      return {
        id: sportId,
        name: sportId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        status: 'INACTIVE',
        planType: null,
        activatedAt: null,
        expiresAt: null,
      };
    });

    return NextResponse.json({ sports: sportsData });
  } catch (error) {
    console.error('Get org sports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
