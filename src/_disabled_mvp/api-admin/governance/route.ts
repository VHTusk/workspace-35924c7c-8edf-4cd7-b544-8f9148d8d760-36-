/**
 * VALORHIVE Governance Automation API (v3.50.0)
 * 
 * Endpoints for:
 * - Director assignment
 * - Admin inactivity detection
 * - Region load balancing
 * - Emergency control
 */

import { NextRequest, NextResponse } from 'next/server';
import { assignTournamentDirector, previewDirectorAssignment, overrideDirectorAssignment } from '@/lib/director-assignment';
import { detectInactiveAdmins, getAdminActivityStatus, resolveInactivityFlag, getInactiveAdminsForRegion } from '@/lib/inactive-admin-detector';
import { getRegionLoadMetrics, findBestAdminForAssignment, getRegionLoadSummary, checkRegionCapacityNeeds, rebalanceRegionLoad } from '@/lib/region-load-balancer';
import { initiateEmergencyControl, getActiveEmergencies, resolveEmergencyControl, checkRegionEmergencyStatus } from '@/lib/emergency-control';
import { SportType } from '@prisma/client';

// ============================================
// GET - Query governance status
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'load-metrics': {
        const sport = searchParams.get('sport') as SportType;
        const stateCode = searchParams.get('stateCode') ?? undefined;
        const districtName = searchParams.get('districtName') ?? undefined;

        const metrics = await getRegionLoadMetrics(sport, stateCode, districtName);
        return NextResponse.json({ success: true, metrics });
      }

      case 'load-summary': {
        const sport = searchParams.get('sport') as SportType;
        const stateCode = searchParams.get('stateCode') ?? undefined;
        const districtName = searchParams.get('districtName') ?? undefined;

        const summary = await getRegionLoadSummary(sport, stateCode, districtName);
        return NextResponse.json({ success: true, summary });
      }

      case 'capacity-needs': {
        const sport = searchParams.get('sport') as SportType;
        const stateCode = searchParams.get('stateCode') ?? undefined;
        const districtName = searchParams.get('districtName') ?? undefined;

        const needs = await checkRegionCapacityNeeds(sport, stateCode, districtName);
        return NextResponse.json({ success: true, ...needs });
      }

      case 'inactive-admins': {
        const sport = searchParams.get('sport') as SportType;
        const stateCode = searchParams.get('stateCode') ?? undefined;
        const districtName = searchParams.get('districtName') ?? undefined;

        const admins = await getInactiveAdminsForRegion(sport, stateCode, districtName);
        return NextResponse.json({ success: true, admins });
      }

      case 'admin-status': {
        const adminId = searchParams.get('adminId');
        if (!adminId) {
          return NextResponse.json({ success: false, message: 'adminId required' }, { status: 400 });
        }

        const status = await getAdminActivityStatus(adminId);
        return NextResponse.json({ success: true, status });
      }

      case 'active-emergencies': {
        const sport = searchParams.get('sport') as SportType;
        const emergencies = await getActiveEmergencies(sport);
        return NextResponse.json({ success: true, emergencies });
      }

      case 'emergency-status': {
        const stateCode = searchParams.get('stateCode') ?? undefined;
        const districtName = searchParams.get('districtName') ?? undefined;

        const status = await checkRegionEmergencyStatus(stateCode, districtName);
        return NextResponse.json({ success: true, ...status });
      }

      case 'preview-assignment': {
        const sport = searchParams.get('sport') as SportType;
        const stateCode = searchParams.get('stateCode') ?? undefined;
        const districtName = searchParams.get('districtName') ?? undefined;
        const city = searchParams.get('city') ?? undefined;

        const preview = await previewDirectorAssignment(sport, stateCode, districtName, city);
        return NextResponse.json({ success: true, preview });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Governance API error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST - Execute governance actions
// ============================================

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    const body = await request.json();

    switch (action) {
      case 'assign-director': {
        const { tournamentId, options } = body;
        if (!tournamentId) {
          return NextResponse.json({ success: false, message: 'tournamentId required' }, { status: 400 });
        }

        const result = await assignTournamentDirector(tournamentId, options);
        return NextResponse.json(result);
      }

      case 'override-director': {
        const { tournamentId, newDirectorId, overrideById, reason } = body;
        if (!tournamentId || !newDirectorId || !overrideById || !reason) {
          return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const result = await overrideDirectorAssignment(tournamentId, newDirectorId, overrideById, reason);
        return NextResponse.json(result);
      }

      case 'detect-inactive': {
        const result = await detectInactiveAdmins();
        return NextResponse.json({ success: true, ...result });
      }

      case 'resolve-inactivity': {
        const { adminId, resolvedById, notes } = body;
        if (!adminId || !resolvedById) {
          return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const result = await resolveInactivityFlag(adminId, resolvedById, notes);
        return NextResponse.json(result);
      }

      case 'find-best-admin': {
        const { sport, stateCode, districtName, options } = body;
        if (!sport) {
          return NextResponse.json({ success: false, message: 'sport required' }, { status: 400 });
        }

        const result = await findBestAdminForAssignment(sport, stateCode, districtName, options);
        return NextResponse.json(result);
      }

      case 'rebalance-load': {
        const { sport, stateCode, districtName } = body;
        if (!sport) {
          return NextResponse.json({ success: false, message: 'sport required' }, { status: 400 });
        }

        const result = await rebalanceRegionLoad(sport, stateCode, districtName);
        return NextResponse.json(result);
      }

      case 'initiate-emergency': {
        const { adminId, triggerType, triggerDescription, triggeredById } = body;
        if (!adminId || !triggerType || !triggerDescription) {
          return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const result = await initiateEmergencyControl(adminId, triggerType, triggerDescription, triggeredById);
        return NextResponse.json(result);
      }

      case 'resolve-emergency': {
        const { emergencyId, resolvedById, restoreOriginal, notes } = body;
        if (!emergencyId || !resolvedById) {
          return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const result = await resolveEmergencyControl(emergencyId, resolvedById, restoreOriginal ?? false, notes);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Governance API error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
