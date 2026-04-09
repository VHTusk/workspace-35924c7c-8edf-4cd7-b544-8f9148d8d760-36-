import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { RegistrationStatus, TournamentType, TournamentStatus, SportType, AccountTier, AbusePattern, AbuseSeverity, TournamentScope, UserSportEnrollmentSource } from '@prisma/client';
import { createRazorpayOrder } from '@/lib/payments/razorpay';
import { v4 as uuidv4 } from 'uuid';
import { triggerTournamentRegistrationNotification } from '@/lib/notification-triggers';
import { checkSchedulingConflicts, formatConflictMessage } from '@/lib/scheduling-conflicts';
import { getAuthenticatedUser } from '@/lib/auth';
import { log } from '@/lib/logger';
import { 
  hashRequestBody, 
  checkIdempotencyKey, 
  storeIdempotencyKey,
  generateIdempotencyKey,
  type IdempotencyCheckResult 
} from '@/lib/idempotency';
import {
  buildTournamentMembershipRequiredResponse,
  getTournamentMembershipStatus,
} from '@/lib/tournament-membership';
import {
  buildTournamentProfileRequiredResponse,
  getTournamentProfileStatus,
} from '@/lib/profile-completeness';
import {
  detectSuspiciousTournamentRegistration,
  detectDeviceFingerprint,
  generateDeviceFingerprint,
  checkMultipleAccounts,
  recordAbuseEvent,
  getClientIpAddress,
  getUserAgent,
  shouldBlockAction,
} from '@/lib/abuse-detection';
import { ensureUserSportEnrollment } from '@/lib/user-sport';

// Player registers for a tournament (with IDEMPOTENCY PROTECTION)
// Returns payment order if entry fee > 0
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { user, session } = auth;

    const { id: tournamentId } = await params;

    // Parse request body for idempotency check
    const body = await request.json().catch(() => ({}));

    // Generate idempotency key for registration
    // Uses client-provided key or generates one from user + tournament
    let idempotencyKey = request.headers.get('x-idempotency-key');
    
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey(
        user.id,
        'REGISTRATION',
        { tournamentId }
      );
    }

    // Hash request body for verification
    const requestBodyHash = hashRequestBody(body);

    // Check for duplicate request
    const idempotencyCheck: IdempotencyCheckResult = await checkIdempotencyKey(
      idempotencyKey,
      requestBodyHash
    );

    if (idempotencyCheck.isDuplicate && idempotencyCheck.previousResponse) {
      // Return cached response for duplicate request
      log.info('Idempotent registration request detected - returning cached response', { 
        tournamentId,
        userId: user.id,
        idempotencyKey 
      });
      return NextResponse.json(idempotencyCheck.previousResponse.body, {
        status: idempotencyCheck.previousResponse.status,
        headers: {
          'X-Idempotent-Replayed': 'true',
        },
      });
    }

    // Detect client source (mobile vs web)
    const authSource = request.headers.get('x-auth-source');
    const userAgent = request.headers.get('user-agent') || '';
    const isMobileClient = authSource === 'bearer' ||
                          userAgent.includes('ReactNative') ||
                          userAgent.includes('Flutter') ||
                          userAgent.includes('VALORHIVE-Mobile');
    const clientSource = isMobileClient ? 'mobile_app' : 'web';

    // Get client info for abuse detection
    const ipAddress = getClientIpAddress(request);
    const userAgentStr = getUserAgent(request);
    const deviceData = detectDeviceFingerprint(request);
    const deviceFingerprint = generateDeviceFingerprint(deviceData);

    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Check tournament status
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      return NextResponse.json(
        { error: 'Tournament is not open for registration' },
        { status: 400 }
      );
    }

    // Check sport matches
    if (tournament.sport !== session.sport) {
      return NextResponse.json(
        { error: 'This tournament is for a different sport' },
        { status: 400 }
      );
    }

    // CRITICAL: Check account tier - FAN (free) users cannot register for paid tournaments
    if (user.accountTier === AccountTier.FAN && tournament.entryFee > 0) {
      return NextResponse.json(
        { 
          error: 'Free tier (FAN) accounts cannot register for paid tournaments',
          code: 'UPGRADE_REQUIRED',
          message: 'Please upgrade to PLAYER tier to register for paid tournaments',
          entryFee: tournament.entryFee,
        },
        { status: 403 }
      );
    }

    // Check if already registered
    const existingRegistration = await db.tournamentRegistration.findUnique({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
    });

    if (existingRegistration) {
      if (existingRegistration.status === RegistrationStatus.CONFIRMED) {
        return NextResponse.json(
          { error: 'Already registered for this tournament' },
          { status: 400 }
        );
      }
    }

    const membershipStatus = await getTournamentMembershipStatus(user.id, tournament.sport, tournamentId);
    if (membershipStatus.requiresMembership) {
      return NextResponse.json(
        {
          ...buildTournamentMembershipRequiredResponse(tournament.sport),
          scope: tournament.scope ?? TournamentScope.CITY,
        },
        { status: 403 }
      );
    }

    // Check for scheduling conflicts
    const conflictCheck = await checkSchedulingConflicts(user.id, tournamentId);
    if (conflictCheck.hasConflicts) {
      return NextResponse.json(
        { 
          error: 'Scheduling conflict detected',
          message: formatConflictMessage(conflictCheck.conflicts),
          conflicts: conflictCheck.conflicts.map(c => ({
            tournamentId: c.tournamentId,
            tournamentName: c.tournamentName,
            startDate: c.startDate.toISOString(),
            endDate: c.endDate.toISOString(),
          })),
        },
        { status: 409 }
      );
    }

    // === ABUSE DETECTION: Suspicious Tournament Registration ===
    const suspiciousRegCheck = await detectSuspiciousTournamentRegistration(
      user.id,
      tournamentId
    );
    
    if (suspiciousRegCheck.detected) {
      await recordAbuseEvent(
        AbusePattern.SUSPICIOUS_TOURNAMENT_REGISTRATIONS,
        suspiciousRegCheck.severity || AbuseSeverity.MEDIUM,
        user.id,
        undefined,
        ipAddress,
        userAgentStr,
        suspiciousRegCheck.metadata || {}
      );
      
      log.warn('Suspicious tournament registration detected', {
        userId: user.id,
        tournamentId,
        pattern: suspiciousRegCheck.pattern,
        metadata: suspiciousRegCheck.metadata,
      });
      
      if (shouldBlockAction(suspiciousRegCheck.riskScore, suspiciousRegCheck.severity)) {
        return NextResponse.json(
          { error: 'Registration blocked due to suspicious activity', code: 'SUSPICIOUS_ACTIVITY' },
          { status: 403 }
        );
      }
    }

    const tournamentProfileStatus = getTournamentProfileStatus(user);

    // For INDIVIDUAL tournaments, check profile readiness
    if (tournament.type === TournamentType.INDIVIDUAL) {
      if (!tournamentProfileStatus.canRegister) {
        return NextResponse.json(
          buildTournamentProfileRequiredResponse(tournamentProfileStatus, tournament.sport),
          { status: 403 }
        );
      }
    }

    // For INTRA_ORG tournaments, check if player belongs to host org
    if (tournament.type === TournamentType.INTRA_ORG && tournament.orgId) {
      const rosterEntry = await db.orgRosterPlayer.findFirst({
        where: {
          userId: user.id,
          orgId: tournament.orgId,
          isActive: true,
        },
      });

      if (!rosterEntry) {
        return NextResponse.json(
          { error: 'Only members of the host organization can register for this tournament' },
          { status: 403 }
        );
      }

      if (!tournamentProfileStatus.canRegister) {
        return NextResponse.json(
          buildTournamentProfileRequiredResponse(tournamentProfileStatus, tournament.sport),
          { status: 403 }
        );
      }
    }

    // For INTER_ORG tournaments, players cannot register directly
    if (tournament.type === TournamentType.INTER_ORG) {
      return NextResponse.json(
        { error: 'INTER_ORG tournaments require organization registration. Please contact your organization admin.' },
        { status: 400 }
      );
    }

    // Determine entry fee
    const entryFee = tournament.entryFee || 0;
    const amountInPaise = entryFee * 100; // Convert to paise

    if (existingRegistration?.status === RegistrationStatus.PENDING && entryFee > 0) {
      await ensureUserSportEnrollment(
        db,
        user.id,
        tournament.sport,
        UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
      );

      const receipt = `REG_${tournamentId.slice(0, 8)}_${Date.now()}_${uuidv4().slice(0, 8)}`;

      const order = await createRazorpayOrder({
        amount: amountInPaise,
        receipt,
        notes: {
          paymentType: 'TOURNAMENT_ENTRY',
          tournamentId,
          userId: user.id,
          sport: tournament.sport,
          source: clientSource,
        },
      });

      await db.paymentLedger.create({
        data: {
          userId: user.id,
          tournamentId,
          sport: tournament.sport,
          amount: amountInPaise,
          type: 'TOURNAMENT_ENTRY',
          status: 'INITIATED',
          razorpayId: order.id,
          description: `Tournament registration retry: ${tournament.name}`,
        },
      });

      return NextResponse.json({
        success: true,
        requiresPayment: true,
        membershipExemptedForFirstTournament: membershipStatus.canUseFirstTournamentExemption,
        registration: {
          id: existingRegistration.id,
          status: existingRegistration.status,
          tournamentName: tournament.name,
          amount: entryFee,
        },
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        payer: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        tournamentId,
        amountDisplay: `₹${entryFee.toLocaleString('en-IN')}`,
      });
    }

    // ATOMIC TRANSACTION: Check capacity and create registration together
    // This prevents race conditions where multiple users could exceed capacity
    const result = await db.$transaction(async (tx) => {
      // Re-check capacity WITHIN transaction to ensure atomicity
      const currentRegistrationCount = await tx.tournamentRegistration.count({
        where: { tournamentId },
      });

      if (currentRegistrationCount >= tournament.maxPlayers) {
        throw new Error('TOURNAMENT_FULL');
      }

      // If no entry fee, create registration directly
      if (entryFee === 0) {
        await ensureUserSportEnrollment(
          tx,
          user.id,
          tournament.sport,
          UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
        );

        const registration = await tx.tournamentRegistration.create({
          data: {
            tournamentId,
            userId: user.id,
            status: RegistrationStatus.CONFIRMED,
            amount: 0,
          },
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: user.id,
            sport: tournament.sport as SportType,
            type: 'TOURNAMENT_REGISTERED',
            title: 'Registration Confirmed',
            message: `You have been registered for ${tournament.name}`,
            link: `/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}`,
          },
        });

        return { type: 'free', registration };
      }

      // If entry fee > 0, create pending registration
      // Payment order will be created after transaction
      await ensureUserSportEnrollment(
        tx,
        user.id,
        tournament.sport,
        UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
      );

      const registration = await tx.tournamentRegistration.create({
        data: {
          tournamentId,
          userId: user.id,
          status: RegistrationStatus.PENDING,
          amount: entryFee,
        },
      });

      return { type: 'paid', registration };
    });

    // Handle free registration success
    if (result.type === 'free') {
      // Trigger multi-channel notification (email, WhatsApp) - non-blocking
      triggerTournamentRegistrationNotification(
        user.id,
        tournamentId,
        tournament.name,
        tournament.sport as SportType
      ).catch(error => {
        log.error('Failed to trigger tournament registration notification', {
          userId: user.id,
          tournamentId,
          error: error instanceof Error ? error.message : String(error)
        });
      });

      return NextResponse.json({
        success: true,
        membershipExemptedForFirstTournament: membershipStatus.canUseFirstTournamentExemption,
        registration: {
          id: result.registration.id,
          status: result.registration.status,
          tournamentName: tournament.name,
          amount: 0,
        },
      });
    }

    // Handle paid registration - create payment order
    const receipt = `REG_${tournamentId.slice(0, 8)}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amount: amountInPaise,
      receipt,
      notes: {
        paymentType: 'TOURNAMENT_ENTRY',
        tournamentId,
        userId: user.id,
        sport: tournament.sport,
        source: clientSource,
      },
    });

    // Store payment record in database with tournament context
    await db.paymentLedger.create({
      data: {
        userId: user.id,
        tournamentId,
        sport: tournament.sport,
        amount: amountInPaise,
        type: 'TOURNAMENT_ENTRY',
        status: 'INITIATED',
        razorpayId: order.id,
        description: `Tournament registration: ${tournament.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      membershipExemptedForFirstTournament: membershipStatus.canUseFirstTournamentExemption,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      payer: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      tournamentId,
      amountDisplay: `₹${entryFee.toLocaleString('en-IN')}`,
    });
  } catch (error: unknown) {
    // Handle specific transaction errors
    if (error instanceof Error && error.message === 'TOURNAMENT_FULL') {
      return NextResponse.json(
        { error: 'Tournament is full' },
        { status: 400 }
      );
    }

    log.errorWithStack('Tournament registration error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
