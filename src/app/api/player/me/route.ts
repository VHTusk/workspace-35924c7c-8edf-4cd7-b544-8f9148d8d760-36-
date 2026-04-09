import { NextRequest, NextResponse } from "next/server";
import { validateSessionForSport } from "@/lib/session";
import { db } from "@/lib/db";
import { SportType, UserSportEnrollmentSource } from "@prisma/client";
import { shouldEnforceIdentityLock } from "@/lib/identity-lock";
import { ensureUserSportEnrollment } from "@/lib/user-sport";

const requiredProfileFields = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "dob", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "state", label: "State" },
  { key: "district", label: "District" },
  { key: "pinCode", label: "PIN Code" },
];

function getAgeFromDob(dob: Date | null): number | null {
  if (!dob) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/**
 * Get authenticated player data
 * GET /api/player/me?sport=CORNHOLE
 * 
 * CRITICAL: Each sport is a SEPARATE platform.
 * Users must only access data for the sport they are registered for.
 */
export async function GET(request: NextRequest) {
  try {
    // Get expected sport from query parameter
    const { searchParams } = new URL(request.url);
    const expectedSport = searchParams.get("sport");

    if (!expectedSport) {
      return NextResponse.json({ 
        error: "Sport parameter required",
        code: "SPORT_REQUIRED" 
      }, { status: 400 });
    }

    // Validate session for the specific sport
    const validation = await validateSessionForSport(expectedSport);

    if (!validation.valid) {
      if (validation.error?.code === 'SPORT_MISMATCH') {
        return NextResponse.json({ 
          error: validation.error.message,
          code: "SPORT_MISMATCH",
          sessionSport: validation.error.sessionSport,
          hint: `You are logged in for ${validation.error.sessionSport}. Please register for ${expectedSport.toUpperCase()} to access this platform.`,
        }, { status: 403 });
      }
      
      return NextResponse.json({ 
        error: validation.error?.message || "Not authenticated",
        code: validation.error?.code || "UNAUTHORIZED",
      }, { status: 401 });
    }

    const session = validation.session!;
    const userId = session.userId!;
    const currentSport = expectedSport.toUpperCase() as SportType;

    // Get full user data with relations
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        rating: true,
        subscriptions: {
          where: { status: "ACTIVE", sport: currentSport },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        affiliatedOrg: {
          select: {
            id: true,
            name: true,
            type: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await ensureUserSportEnrollment(
      db,
      user.id,
      currentSport,
      UserSportEnrollmentSource.ACCOUNT_REGISTRATION,
    );

    const identityLocked = user.identityLocked
      ? await shouldEnforceIdentityLock(db, user.id)
      : false;

    const resolvedAge = user.age ?? getAgeFromDob(user.dob);

    // Calculate profile completion
    const userData: Record<string, string | number | null | undefined> = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      dob: user.dob ? user.dob.toISOString() : null,
      gender: user.gender,
      state: user.state,
      district: user.district,
      pinCode: user.pinCode,
    };

    const missingFields: string[] = [];
    let filledCount = 0;

    requiredProfileFields.forEach(field => {
      if (userData[field.key]) {
        filledCount++;
      } else {
        missingFields.push(field.label);
      }
    });

    const profileCompletion = Math.round((filledCount / requiredProfileFields.length) * 100);

    // Check subscription status
    const activeSubscription = user.subscriptions[0];
    const isSubscribed = !!activeSubscription && new Date(activeSubscription.endDate) > new Date();

    // Get follower and following counts
    const [followersCount, followingCount] = await Promise.all([
      db.userFollow.count({
        where: { followingId: user.id, sport: currentSport },
      }),
      db.userFollow.count({
        where: { followerId: user.id, sport: currentSport },
      }),
    ]);

    return NextResponse.json({
      id: user.id,
      playerId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      age: resolvedAge,
      dob: user.dob,
      gender: user.gender,
      identityLocked,
      emailVerified: user.emailVerified,
      phoneVerified: user.verified,
      photoUrl: user.photoUrl,
      bio: user.bio,
      address: user.address,
      city: user.city,
      state: user.state,
      district: user.district,
      pinCode: user.pinCode,
      sport: currentSport,
      // Emergency contact
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      emergencyContactRelation: user.emergencyContactRelation,
      // Stats
      score: user.visiblePoints,
      visiblePoints: user.visiblePoints,
      elo: user.hiddenElo,
      rank: user.rating ? Math.floor(user.hiddenElo / 100) : 0,
      tournaments: user.rating?.tournamentsPlayed || 0,
      tournamentsPlayed: user.rating?.tournamentsPlayed || 0,
      tournamentsWon: user.rating?.tournamentsWon || 0,
      wins: user.rating?.wins || 0,
      losses: user.rating?.losses || 0,
      matches: user.rating?.matchesPlayed || 1,
      winRate: user.rating 
        ? `${Math.round((user.rating.wins / (user.rating.matchesPlayed || 1)) * 100)}%`
        : "0%",
      profileCompletion,
      missingFields,
      // Privacy settings
      hideElo: user.hideElo,
      showOnLeaderboard: user.showOnLeaderboard,
      // Subscription status
      isSubscribed,
      subscriptionPlan: isSubscribed ? (activeSubscription.amount >= 5000 ? "Elite" : "Pro") : null,
      // Organization fields
      playerOrgType: user.playerOrgType,
      verificationStatus: user.verificationStatus,
      affiliatedOrgId: user.affiliatedOrgId,
      affiliatedOrg: user.affiliatedOrg,
      idDocumentUrl: user.idDocumentUrl,
      idDocumentType: user.idDocumentType,
      orgVerifiedAt: user.orgVerifiedAt,
      verificationNotes: user.verificationNotes,
      // Profile update timestamp
      profileUpdatedAt: user.profileUpdatedAt,
      sessionCreatedAt: session.createdAt ?? null,
      sessionLastActivityAt: session.lastActivityAt ?? null,
      createdAt: user.createdAt,
      // Social stats
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Error fetching player:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
