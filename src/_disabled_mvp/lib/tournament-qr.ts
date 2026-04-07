/**
 * VALORHIVE Player QR Code Check-in System
 * Generates unique QR codes per player per tournament for venue check-in
 * Integrates with VenueFlow check-in system
 */

import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { SportType } from '@prisma/client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com';

/**
 * QR Code Data Structure
 */
export interface PlayerQRData {
  tournamentId: string;
  playerId: string;
  registrationId: string;
  sport: SportType;
  checkInToken: string;
  expiresAt: Date;
}

/**
 * Generate a unique check-in token for a player in a tournament
 */
export async function generatePlayerCheckInToken(
  tournamentId: string,
  playerId: string,
  registrationId: string,
  sport: SportType
): Promise<{ token: string; qrData: PlayerQRData; qrUrl: string }> {
  // Generate unique token
  const checkInToken = `ci_${nanoid(16)}`;

  // Token expires 1 hour after tournament end date
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { endDate: true },
  });

  const expiresAt = tournament?.endDate || new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Store check-in token in database
  await db.tournamentCheckin.upsert({
    where: {
      tournamentId_playerId: { tournamentId, playerId },
    },
    create: {
      tournamentId,
      playerId,
      registrationId,
      checkInToken,
      status: 'NOT_CHECKED_IN',
      checkInTokenExpiresAt: expiresAt,
    },
    update: {
      checkInToken,
      checkInTokenExpiresAt: expiresAt,
    },
  });

  const qrData: PlayerQRData = {
    tournamentId,
    playerId,
    registrationId,
    sport,
    checkInToken,
    expiresAt,
  };

  // Generate QR code URL (deep link format)
  const qrUrl = `${APP_URL}/checkin?t=${tournamentId}&p=${playerId}&token=${checkInToken}`;

  return { token: checkInToken, qrData, qrUrl };
}

/**
 * Verify and process player check-in via QR code
 */
export async function verifyAndCheckInPlayer(
  tournamentId: string,
  playerId: string,
  checkInToken: string,
  scannedBy?: string // Director/Admin ID who scanned the QR
): Promise<{
  success: boolean;
  status: 'checked_in' | 'already_checked_in' | 'invalid_token' | 'expired' | 'not_registered';
  message: string;
  player?: {
    id: string;
    name: string;
    checkedInAt?: Date;
  };
}> {
  // Find the check-in record
  const checkInRecord = await db.tournamentCheckin.findUnique({
    where: {
      tournamentId_playerId: { tournamentId, playerId },
    },
    include: {
      player: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!checkInRecord) {
    return {
      success: false,
      status: 'not_registered',
      message: 'Player is not registered for this tournament',
    };
  }

  // Verify token
  if (checkInRecord.checkInToken !== checkInToken) {
    return {
      success: false,
      status: 'invalid_token',
      message: 'Invalid check-in token',
    };
  }

  // Check if token is expired
  if (checkInRecord.checkInTokenExpiresAt && checkInRecord.checkInTokenExpiresAt < new Date()) {
    return {
      success: false,
      status: 'expired',
      message: 'Check-in token has expired',
    };
  }

  // Check if already checked in
  if (checkInRecord.status === 'CHECKED_IN') {
    return {
      success: true,
      status: 'already_checked_in',
      message: 'Player is already checked in',
      player: {
        id: checkInRecord.player.id,
        name: `${checkInRecord.player.firstName} ${checkInRecord.player.lastName}`,
        checkedInAt: checkInRecord.checkedInAt || undefined,
      },
    };
  }

  // Perform check-in
  const now = new Date();
  await db.tournamentCheckin.update({
    where: { id: checkInRecord.id },
    data: {
      status: 'CHECKED_IN',
      checkedInAt: now,
      checkedInBy: scannedBy,
    },
  });

  // Log to VenueFlow if available
  await logCheckInToVenueFlow(tournamentId, playerId, now, scannedBy);

  return {
    success: true,
    status: 'checked_in',
    message: 'Player checked in successfully',
    player: {
      id: checkInRecord.player.id,
      name: `${checkInRecord.player.firstName} ${checkInRecord.player.lastName}`,
      checkedInAt: now,
    },
  };
}

/**
 * Log check-in to VenueFlow system
 */
async function logCheckInToVenueFlow(
  tournamentId: string,
  playerId: string,
  checkedInAt: Date,
  scannedBy?: string
): Promise<void> {
  try {
    await db.venueFlowLog.create({
      data: {
        tournamentId,
        action: 'PLAYER_CHECKIN',
        entityType: 'PLAYER',
        entityId: playerId,
        metadata: JSON.stringify({
          checkedInAt,
          scannedBy,
          method: 'QR_CODE',
        }),
      },
    });
  } catch (error) {
    console.error('Failed to log check-in to VenueFlow:', error);
  }
}

/**
 * Get check-in status for a player in a tournament
 */
export async function getPlayerCheckInStatus(
  tournamentId: string,
  playerId: string
): Promise<{
  isRegistered: boolean;
  isCheckedIn: boolean;
  checkedInAt?: Date;
  qrCodeUrl?: string;
}> {
  const checkIn = await db.tournamentCheckin.findUnique({
    where: {
      tournamentId_playerId: { tournamentId, playerId },
    },
  });

  if (!checkIn) {
    return { isRegistered: false, isCheckedIn: false };
  }

  const qrCodeUrl = checkIn.checkInToken
    ? `${APP_URL}/api/tournaments/${tournamentId}/player-qr/${playerId}`
    : undefined;

  return {
    isRegistered: true,
    isCheckedIn: checkIn.status === 'CHECKED_IN',
    checkedInAt: checkIn.checkedInAt || undefined,
    qrCodeUrl,
  };
}

/**
 * Get all check-in stats for a tournament
 */
export async function getTournamentCheckInStats(tournamentId: string): Promise<{
  total: number;
  checkedIn: number;
  notCheckedIn: number;
  noShow: number;
  percentage: number;
}> {
  const stats = await db.tournamentCheckin.groupBy({
    by: ['status'],
    where: { tournamentId },
    _count: true,
  });

  const total = stats.reduce((sum, s) => sum + s._count, 0);
  const checkedIn = stats.find(s => s.status === 'CHECKED_IN')?._count || 0;
  const notCheckedIn = stats.find(s => s.status === 'NOT_CHECKED_IN')?._count || 0;
  const noShow = stats.find(s => s.status === 'NO_SHOW_CONFIRMED')?._count || 0;

  return {
    total,
    checkedIn,
    notCheckedIn,
    noShow,
    percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
  };
}

/**
 * Generate QR code image URL using external service
 */
export function getQRCodeImageUrl(data: string, size = 300): string {
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&bgcolor=ffffff&color=1a1a2e`;
}
