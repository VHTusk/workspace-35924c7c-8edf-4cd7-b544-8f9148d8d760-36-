import { RegistrationStatus, SportType, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";

const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = [
  RegistrationStatus.PENDING,
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.WAITLISTED,
];

export interface TournamentMembershipStatus {
  hasActiveSubscription: boolean;
  canUseFirstTournamentExemption: boolean;
  requiresMembership: boolean;
}

export async function getTournamentMembershipStatus(
  userId: string,
  sport: SportType,
  currentTournamentId?: string,
): Promise<TournamentMembershipStatus> {
  const activeSubscription = await db.subscription.findFirst({
    where: {
      userId,
      sport,
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: new Date() },
    },
    select: { id: true },
  });

  if (activeSubscription) {
    return {
      hasActiveSubscription: true,
      canUseFirstTournamentExemption: false,
      requiresMembership: false,
    };
  }

  const tournamentFilter = currentTournamentId ? { not: currentTournamentId } : undefined;

  const [existingIndividualEntry, existingTeamEntry, existingResult] = await Promise.all([
    db.tournamentRegistration.findFirst({
      where: {
        userId,
        status: { in: ACTIVE_REGISTRATION_STATUSES },
        tournament: {
          sport,
          ...(tournamentFilter ? { id: tournamentFilter } : {}),
        },
      },
      select: { id: true },
    }),
    db.tournamentTeam.findFirst({
      where: {
        status: { in: ACTIVE_REGISTRATION_STATUSES },
        team: {
          members: {
            some: { userId },
          },
        },
        tournament: {
          sport,
          ...(tournamentFilter ? { id: tournamentFilter } : {}),
        },
      },
      select: { id: true },
    }),
    db.tournamentResult.findFirst({
      where: {
        userId,
        sport,
        ...(tournamentFilter ? { tournamentId: tournamentFilter } : {}),
      },
      select: { id: true },
    }),
  ]);

  const hasPlayedInSportTournament = !!(existingIndividualEntry || existingTeamEntry || existingResult);

  return {
    hasActiveSubscription: false,
    canUseFirstTournamentExemption: !hasPlayedInSportTournament,
    requiresMembership: hasPlayedInSportTournament,
  };
}

export function buildTournamentMembershipRequiredResponse(sport: SportType) {
  return {
    error: "Annual membership required",
    code: "SUBSCRIPTION_REQUIRED",
    message:
      "Annual membership is required after your first tournament in this sport. Your one-time introductory tournament benefit has already been used.",
    subscriptionUrl: `/${sport.toLowerCase()}/subscription`,
  };
}
