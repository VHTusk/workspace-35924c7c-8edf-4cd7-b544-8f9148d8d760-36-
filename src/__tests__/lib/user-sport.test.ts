import { describe, expect, it, vi } from "vitest";
import {
  ReferralType,
  SportType,
  UserSportEnrollmentSource,
  UserSportEnrollmentStatus,
} from "@prisma/client";
import {
  buildLeaderboardEligibleUserWhere,
  buildReferralWhere,
  ensureUserSportEnrollment,
} from "@/lib/user-sport";

describe("user-sport helpers", () => {
  it("builds leaderboard eligibility around actual sport participation", () => {
    const where = buildLeaderboardEligibleUserWhere(SportType.DARTS, {
      requirePublic: true,
      extra: { city: "Delhi" },
    });

    expect(where).toEqual({
      sport: SportType.DARTS,
      isActive: true,
      isAnonymized: false,
      showOnLeaderboard: true,
      rating: {
        is: {
          sport: SportType.DARTS,
          matchesPlayed: { gt: 0 },
        },
      },
      city: "Delhi",
    });
  });

  it("builds sport-scoped referral filters", () => {
    expect(
      buildReferralWhere("user_1", {
        sport: SportType.CORNHOLE,
        referralType: ReferralType.SPORT_SPECIFIC,
      }),
    ).toEqual({
      referrerId: "user_1",
      referralType: ReferralType.SPORT_SPECIFIC,
      sport: SportType.CORNHOLE,
    });
  });

  it("upserts user sport enrollment with the correct source", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "enrollment_1" });

    await ensureUserSportEnrollment(
      { userSportEnrollment: { upsert } },
      "user_1",
      SportType.CORNHOLE,
      UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_sport: {
          userId: "user_1",
          sport: SportType.CORNHOLE,
        },
      },
      create: {
        userId: "user_1",
        sport: SportType.CORNHOLE,
        source: UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
        status: UserSportEnrollmentStatus.ACTIVE,
      },
      update: {
        status: UserSportEnrollmentStatus.ACTIVE,
        source: UserSportEnrollmentSource.TOURNAMENT_REGISTRATION,
      },
    });
  });
});
