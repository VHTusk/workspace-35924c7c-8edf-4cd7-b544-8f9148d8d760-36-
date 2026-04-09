import {
  Prisma,
  ReferralType,
  SportType,
  UserSportEnrollmentSource,
  UserSportEnrollmentStatus,
} from "@prisma/client";

type UserSportEnrollmentClient = {
  userSportEnrollment: {
    upsert: (args: Prisma.UserSportEnrollmentUpsertArgs) => Promise<unknown>;
  };
};

export async function ensureUserSportEnrollment(
  client: UserSportEnrollmentClient,
  userId: string,
  sport: SportType,
  source: UserSportEnrollmentSource,
) {
  return client.userSportEnrollment.upsert({
    where: {
      userId_sport: {
        userId,
        sport,
      },
    },
    create: {
      userId,
      sport,
      source,
      status: UserSportEnrollmentStatus.ACTIVE,
    },
    update: {
      status: UserSportEnrollmentStatus.ACTIVE,
      source,
    },
  });
}

export function buildLeaderboardEligibleUserWhere(
  sport: SportType,
  options: {
    requirePublic?: boolean;
    extra?: Prisma.UserWhereInput;
  } = {},
): Prisma.UserWhereInput {
  return {
    sport,
    isActive: true,
    isAnonymized: false,
    ...(options.requirePublic ? { showOnLeaderboard: true } : {}),
    rating: {
      is: {
        sport,
        matchesPlayed: { gt: 0 },
      },
    },
    ...options.extra,
  };
}

export function buildReferralWhere(
  referrerId: string,
  options: {
    sport?: SportType | null;
    referralType?: ReferralType | "ALL";
  } = {},
): Prisma.ReferralWhereInput {
  const where: Prisma.ReferralWhereInput = {
    referrerId,
  };

  if (options.referralType && options.referralType !== "ALL") {
    where.referralType = options.referralType;
  }

  if (options.sport) {
    where.sport = options.sport;
  }

  return where;
}
