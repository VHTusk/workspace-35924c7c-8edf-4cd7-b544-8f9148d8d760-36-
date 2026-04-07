/**
 * Admin Duel Approval API
 * 
 * POST /api/admin/duels/[id]/approve - Approve or reject a duel
 * 
 * @version 3.73.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DuelStatus, DuelApprovalStatus } from '@prisma/client';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// POST - Approve or Reject a Duel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: duelId } = await params;
    
    // Authenticate admin
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const session = await validateSession(sessionToken);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    // Check if user has admin privileges
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        role: true, 
        adminAssignments: { 
          where: { isActive: true },
          select: { adminRole: true, sport: true }
        }
      }
    });
    
    if (!user || (user.role !== 'ADMIN' && user.adminAssignments.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Get request body
    const body = await request.json();
    const { action, notes, rejectionReason } = body;
    
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }
    
    // Fetch the duel
    const duel = await db.duelMatch.findUnique({
      where: { id: duelId },
      include: {
        host: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        venue: true,
        venueSlot: true,
      }
    });
    
    if (!duel) {
      return NextResponse.json(
        { success: false, error: 'Duel not found' },
        { status: 404 }
      );
    }
    
    // Check if duel is pending approval
    if (duel.approvalStatus !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Duel is not pending approval' },
        { status: 400 }
      );
    }
    
    if (action === 'approve') {
      // Approve the duel
      const updatedDuel = await db.duelMatch.update({
        where: { id: duelId },
        data: {
          approvalStatus: DuelApprovalStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: user.id,
          approvalNotes: notes || null,
          status: DuelStatus.OPEN,
          publishedAt: new Date(),
        }
      });
      
      // Lock the venue slot if exists
      if (duel.venueSlot) {
        await db.duelVenueSlot.update({
          where: { id: duel.venueSlot.id },
          data: {
            status: 'RESERVED',
            lockedById: duel.hostId,
            lockedAt: new Date(),
            lockExpiresAt: new Date(duel.scheduledStart.getTime() + 24 * 60 * 60 * 1000),
          }
        });
      }
      
      // Send notification to host about approval
      await db.notification.create({
        data: {
          userId: duel.hostId,
          sport: duel.sport,
          type: 'TOURNAMENT_REGISTERED', // Using existing type for duel approval
          title: 'Duel Approved!',
          message: `Your duel match has been approved and is now live!`,
          link: `/${duel.sport.toLowerCase()}/duels/${duelId}`,
        },
      });
      
      return NextResponse.json({
        success: true,
        data: {
          duel: updatedDuel,
          message: 'Duel approved and is now live!'
        }
      });
      
    } else {
      // Reject the duel
      const updatedDuel = await db.duelMatch.update({
        where: { id: duelId },
        data: {
          approvalStatus: DuelApprovalStatus.REJECTED,
          status: DuelStatus.REJECTED,
          rejectionReason: rejectionReason || notes || 'Not specified',
          approvalNotes: notes || null,
        }
      });
      
      // Send notification to host about rejection
      await db.notification.create({
        data: {
          userId: duel.hostId,
          sport: duel.sport,
          type: 'TOURNAMENT_CANCELLED', // Using existing type for rejection
          title: 'Duel Rejected',
          message: `Your duel match was rejected. Reason: ${rejectionReason || notes || 'Not specified'}`,
          link: `/${duel.sport.toLowerCase()}/duels/${duelId}`,
        },
      });
      
      return NextResponse.json({
        success: true,
        data: {
          duel: updatedDuel,
          message: 'Duel rejected'
        }
      });
    }
    
  } catch (error) {
    console.error('[DUEL_APPROVAL_POST]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
