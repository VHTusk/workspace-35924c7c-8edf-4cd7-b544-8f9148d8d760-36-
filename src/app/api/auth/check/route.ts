import { NextRequest, NextResponse } from "next/server";
import { validateSessionForSport } from "@/lib/session";
import { db } from "@/lib/db";
import { clearSessionCookie } from "@/lib/session-helpers";

/**
 * Authentication Check API
 * GET /api/auth/check?sport=CORNHOLE
 * 
 * Returns authentication status, user info, and verification status.
 * 
 * CRITICAL: Each sport is a separate platform. Users must register separately for each sport.
 * If the user is logged in for a different sport, returns SPORT_MISMATCH error.
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

    // Validate session for this specific sport
    const result = await validateSessionForSport(expectedSport);

    if (!result.valid) {
      // Clear invalid cookies
      const response = NextResponse.json(
        { 
          error: result.error?.message || "Not authenticated",
          code: result.error?.code || "UNAUTHORIZED",
          sessionSport: result.error?.sessionSport,
        }, 
        { status: result.error?.code === 'SPORT_MISMATCH' ? 403 : 401 }
      );
      clearSessionCookie(response);
      response.cookies.delete("player_session");
      return response;
    }

    const session = result.session!;

    // User session
    if (session.userId) {
      // Fetch additional verification and profile data
      const userData = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          sport: true,
          city: true,
          district: true,
          state: true,
          emailVerified: true,
          emailVerifiedAt: true,
          verified: true,
          verifiedAt: true,
          photoUrl: true,
          accountTier: true,
          role: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      });

      if (!userData) {
        const response = NextResponse.json({ error: "User not found" }, { status: 404 });
        clearSessionCookie(response);
        return response;
      }

      // Calculate profile completeness
      const requiredFields = [
        { key: 'firstName', value: userData.firstName },
        { key: 'lastName', value: userData.lastName },
        { key: 'email', value: userData.email },
        { key: 'phone', value: userData.phone },
        { key: 'city', value: userData.city },
        { key: 'state', value: userData.state },
      ];

      // District is required for Challenger Mode (active subscription)
      const isChallengerMode = userData.subscriptions && userData.subscriptions.length > 0;
      if (isChallengerMode) {
        requiredFields.push({ key: 'district', value: userData.district });
      }

      const missingFields = requiredFields.filter(f => !f.value).map(f => f.key);
      const profileComplete = missingFields.length === 0;

      return NextResponse.json({ 
        authenticated: true,
        userType: "player",
        user: {
          id: userData.id,
          sport: userData.sport,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phone: userData.phone,
          photoUrl: userData.photoUrl,
          accountTier: userData.accountTier,
          role: userData.role,
          city: userData.city,
          district: userData.district,
          state: userData.state,
        },
        // Verification status
        verification: {
          emailVerified: userData.emailVerified,
          emailVerifiedAt: userData.emailVerifiedAt,
          phoneVerified: userData.verified,
          phoneVerifiedAt: userData.verifiedAt,
        },
        // Profile status
        profile: {
          complete: profileComplete,
          missingFields,
          isChallengerMode,
        },
      });
    }

    // Org session
    if (session.orgId) {
      const orgData = await db.organization.findUnique({
        where: { id: session.orgId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          sport: true,
          type: true,
          city: true,
          state: true,
        },
      });

      if (!orgData) {
        const response = NextResponse.json({ error: "Organization not found" }, { status: 404 });
        clearSessionCookie(response);
        response.cookies.delete("org_session");
        return response;
      }

      return NextResponse.json({ 
        authenticated: true,
        userType: "org",
        user: {
          id: orgData.id,
          name: orgData.name,
          email: orgData.email,
          phone: orgData.phone,
          sport: orgData.sport,
          type: orgData.type,
          city: orgData.city,
          state: orgData.state,
        },
      });
    }

    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
