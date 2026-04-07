/**
 * GDPR Data Export API (v3.26.0)
 * 
 * Allows users to download all their personal data in JSON format.
 * Implements GDPR Article 20 - Right to Data Portability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await validateSession();
    
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Collect all user data
    const exportData: Record<string, unknown> = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        userId,
        sport: session.sport,
        format: 'JSON',
        version: '1.0',
      },
    };

    // 1. User profile
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        city: true,
        district: true,
        state: true,
        pinCode: true,
        sport: true,
        role: true,
        hiddenElo: true,
        visiblePoints: true,
        verified: true,
        verifiedAt: true,
        createdAt: true,
        language: true,
        playerOrgType: true,
        // Exclude sensitive fields: password, googleId
      },
    });
    exportData.profile = user;

    // 2. Player rating
    const rating = await db.playerRating.findUnique({
      where: { userId },
    });
    exportData.rating = rating;

    // 3. Subscriptions
    const subscriptions = await db.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    exportData.subscriptions = subscriptions;

    // 4. Tournament registrations
    const tournamentRegistrations = await db.tournamentRegistration.findMany({
      where: { userId },
      include: {
        tournament: {
          select: { id: true, name: true, sport: true, startDate: true, status: true },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });
    exportData.tournamentRegistrations = tournamentRegistrations;

    // 5. Matches (as player A or B)
    const matches = await db.match.findMany({
      where: {
        OR: [{ playerAId: userId }, { playerBId: userId }],
      },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: 100, // Limit for performance
    });
    exportData.matches = matches;

    // 6. Tournament results
    const tournamentResults = await db.tournamentResult.findMany({
      where: { userId },
      include: {
        tournament: {
          select: { id: true, name: true },
        },
      },
      orderBy: { awardedAt: 'desc' },
    });
    exportData.tournamentResults = tournamentResults;

    // 7. Achievements
    const achievements = await db.playerAchievement.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    });
    exportData.achievements = achievements;

    // 8. Notifications
    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    exportData.notifications = notifications;

    // 9. Payment history
    const payments = await db.paymentLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    exportData.payments = payments;

    // 10. Messages sent
    const messages = await db.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    exportData.messagesSent = messages;

    // 11. Activity feed entries
    const activities = await db.activityFeed.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    exportData.activities = activities;

    // 12. Follow relationships
    const following = await db.userFollow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    exportData.following = following;

    const followers = await db.userFollow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    exportData.followers = followers;

    // 13. Organization memberships
    const orgMemberships = await db.orgRosterPlayer.findMany({
      where: { userId },
      include: {
        org: {
          select: { id: true, name: true, type: true },
        },
      },
    });
    exportData.organizationMemberships = orgMemberships;

    // 14. GDPR Consents
    const consents = await db.gdprConsent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    exportData.consents = consents;

    // 15. Device tokens
    const deviceTokens = await db.deviceToken.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        deviceName: true,
        appVersion: true,
        createdAt: true,
        lastUsedAt: true,
        // Exclude actual token for security
      },
    });
    exportData.devices = deviceTokens;

    // 16. Notification preferences
    const notificationPrefs = await db.notificationPreference.findUnique({
      where: { userId },
    });
    exportData.notificationPreferences = notificationPrefs;

    // 17. Email notification settings
    const emailSettings = await db.emailNotificationSetting.findMany({
      where: { userId },
    });
    exportData.emailNotificationSettings = emailSettings;

    // 18. Milestones
    const milestones = await db.milestone.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    });
    exportData.milestones = milestones;

    // 19. Referrals
    const referralsGiven = await db.referral.findMany({
      where: { referrerId: userId },
    });
    exportData.referralsGiven = referralsGiven;

    const referralsReceived = await db.referral.findMany({
      where: { refereeId: userId },
    });
    exportData.referralsReceived = referralsReceived;

    // 20. Leaderboard snapshots
    const leaderboardSnapshots = await db.leaderboardSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    exportData.leaderboardSnapshots = leaderboardSnapshots;

    // Return as downloadable JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const fileName = `valorhive-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[GDPR Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export data', code: 'EXPORT_FAILED' },
      { status: 500 }
    );
  }
}
