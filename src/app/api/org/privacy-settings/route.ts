import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedOrg } from '@/lib/auth';

// Privacy settings - stored in a simple key-value approach
// For production, these would be stored in a dedicated OrgPrivacySettings table

// GET - Get organization privacy settings
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { org } = auth;

    // Default privacy settings
    // In production, these would be fetched from database
    const defaultPrivacy = {
      showOnLeaderboard: true,
      showRosterPublicly: true,
      allowPlayerInvites: true,
      showInternalTournaments: true,
      showStudentData: false,
      showHousePoints: true,
      showTeamRegistrations: true,
      showExternalParticipation: true,
    };

    // Try to get stored settings from org's metadata or settings
    // For now, return defaults since we don't have a dedicated table
    
    return NextResponse.json(defaultPrivacy);
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update organization privacy settings
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOrg(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { org } = auth;
    const body = await request.json();

    // In production, these would be stored in a dedicated OrgPrivacySettings table
    // For now, just acknowledge the update
    
    // Validate the settings
    const validSettings = {
      showOnLeaderboard: typeof body.showOnLeaderboard === 'boolean' ? body.showOnLeaderboard : true,
      showRosterPublicly: typeof body.showRosterPublicly === 'boolean' ? body.showRosterPublicly : true,
      allowPlayerInvites: typeof body.allowPlayerInvites === 'boolean' ? body.allowPlayerInvites : true,
      showInternalTournaments: typeof body.showInternalTournaments === 'boolean' ? body.showInternalTournaments : true,
      showStudentData: typeof body.showStudentData === 'boolean' ? body.showStudentData : false,
      showHousePoints: typeof body.showHousePoints === 'boolean' ? body.showHousePoints : true,
      showTeamRegistrations: typeof body.showTeamRegistrations === 'boolean' ? body.showTeamRegistrations : true,
      showExternalParticipation: typeof body.showExternalParticipation === 'boolean' ? body.showExternalParticipation : true,
    };

    // Log the settings update (in production, save to database)
    console.log(`Privacy settings updated for org ${org.id}:`, validSettings);

    return NextResponse.json({ 
      success: true,
      settings: validSettings,
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
