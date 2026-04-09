import { RegistrationStatus, PrismaClient } from "@prisma/client";

export async function shouldEnforceIdentityLock(db: PrismaClient, userId: string): Promise<boolean> {
  const [individualRegistrations, teamRegistrations] = await Promise.all([
    db.tournamentRegistration.count({
      where: {
        userId,
        status: {
          not: RegistrationStatus.CANCELLED,
        },
      },
    }),
    db.tournamentTeam.count({
      where: {
        status: {
          not: RegistrationStatus.CANCELLED,
        },
        team: {
          members: {
            some: {
              userId,
            },
          },
        },
      },
    }),
  ]);

  return individualRegistrations > 0 || teamRegistrations > 0;
}
