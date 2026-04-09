import { NextRequest, NextResponse } from "next/server";
import { GenderCategory, Prisma, SportType } from "@prisma/client";
import { db } from "@/lib/db";
import { getEloTier } from "@/lib/auth";
import { safeParseInt } from "@/lib/validation";
import { log } from "@/lib/logger";
import {
  addCacheHeaders,
  API_CACHE_PREFIXES,
  cacheResponse,
  ENDPOINT_CACHE_CONFIGS,
  generateCacheKeyFromParts,
} from "@/lib/api-cache";

type LeaderboardView = "ranked" | "all" | "unranked";
type GeographyScope = "all" | "district" | "state" | "national";
type AgeGroup = "JUNIOR" | "ADULT" | "MASTERS";
type RankedSort = "rank" | "points" | "winRate";
type DirectorySort = "joinedOn_desc" | "joinedOn_asc" | "name_asc" | "name_desc";

function getAgeGroupFromDob(dob: Date | null): AgeGroup | null {
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

  if (age <= 18) {
    return "JUNIOR";
  }
  if (age <= 35) {
    return "ADULT";
  }
  return "MASTERS";
}

function getDateRangeForAgeGroup(ageGroup: AgeGroup): { gte: Date; lte: Date } {
  const today = new Date();
  const currentYear = today.getFullYear();

  switch (ageGroup) {
    case "JUNIOR":
      return {
        gte: new Date(currentYear - 18, today.getMonth(), today.getDate() + 1),
        lte: today,
      };
    case "ADULT":
      return {
        gte: new Date(currentYear - 35, today.getMonth(), today.getDate()),
        lte: new Date(currentYear - 19, today.getMonth(), today.getDate()),
      };
    case "MASTERS":
      return {
        gte: new Date(1900, 0, 1),
        lte: new Date(currentYear - 36, today.getMonth(), today.getDate()),
      };
  }
}

function getDisplayGender(gender: GenderCategory | null): string | null {
  if (gender === "MALE") {
    return "Male";
  }
  if (gender === "FEMALE") {
    return "Female";
  }
  if (gender === "MIXED" || gender === "OTHER") {
    return "Other";
  }
  return null;
}

function parseView(rawValue: string | null): LeaderboardView {
  if (rawValue === "all" || rawValue === "unranked") {
    return rawValue;
  }
  return "ranked";
}

function parseScope(rawValue: string | null): GeographyScope {
  if (rawValue === "all" || rawValue === "district" || rawValue === "state" || rawValue === "national") {
    return rawValue;
  }
  return "all";
}

function parseAgeGroup(rawValue: string | null): AgeGroup | null {
  if (rawValue === "JUNIOR" || rawValue === "ADULT" || rawValue === "MASTERS") {
    return rawValue;
  }
  return null;
}

function parseGender(rawValue: string | null): GenderCategory | "OTHER" | null {
  if (rawValue === "MALE" || rawValue === "FEMALE" || rawValue === "MIXED" || rawValue === "OTHER") {
    return rawValue;
  }
  return null;
}

function buildRegisteredPlayersWhere(
  sport: SportType,
  options: {
    scope: GeographyScope;
    region: string | null;
    search: string | null;
    gender: GenderCategory | "OTHER" | null;
    ageGroup: AgeGroup | null;
  },
): Prisma.UserWhereInput {
  const andClauses: Prisma.UserWhereInput[] = [
    {
      sport,
      isActive: true,
      isAnonymized: false,
    },
  ];

  if (options.scope === "district" && options.region) {
    andClauses.push({ district: options.region });
  } else if (options.scope === "state" && options.region) {
    andClauses.push({ state: options.region });
  }

  if (options.gender === "OTHER") {
    andClauses.push({
      gender: {
        in: ["MIXED"],
      },
    });
  } else if (options.gender) {
    andClauses.push({ gender: options.gender });
  }

  if (options.ageGroup) {
    andClauses.push({
      dob: getDateRangeForAgeGroup(options.ageGroup),
    });
  }

  if (options.search) {
    andClauses.push({
      OR: [
        { firstName: { contains: options.search, mode: "insensitive" } },
        { lastName: { contains: options.search, mode: "insensitive" } },
        { city: { contains: options.search, mode: "insensitive" } },
        { state: { contains: options.search, mode: "insensitive" } },
        { district: { contains: options.search, mode: "insensitive" } },
      ],
    });
  }

  return { AND: andClauses };
}

function buildRankedWhere(baseWhere: Prisma.UserWhereInput, sport: SportType): Prisma.UserWhereInput {
  return {
    AND: [
      baseWhere,
      {
        rating: {
          is: {
            sport,
            matchesPlayed: { gt: 0 },
          },
        },
      },
    ],
  };
}

function buildUnrankedWhere(baseWhere: Prisma.UserWhereInput, sport: SportType): Prisma.UserWhereInput {
  return {
    AND: [
      baseWhere,
      {
        OR: [
          { rating: { is: null } },
          {
            rating: {
              is: {
                sport,
                matchesPlayed: 0,
              },
            },
          },
        ],
      },
    ],
  };
}

function getLocationLabel(user: {
  city: string | null;
  district: string | null;
  state: string | null;
}) {
  return [user.city || user.district, user.state].filter(Boolean).join(", ");
}

function getStatus(matchesPlayed: number): "Ranked" | "Unranked" | "Inactive" {
  if (matchesPlayed > 0) {
    return "Ranked";
  }
  return "Unranked";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") as SportType;
    const view = parseView(searchParams.get("view"));
    const scope = parseScope(searchParams.get("scope"));
    const region = searchParams.get("region") || searchParams.get("location");
    const search = searchParams.get("search");
    const sort = (searchParams.get("sort") || (view === "ranked" ? "rank" : "joinedOn_desc")) as RankedSort | DirectorySort;
    const gender = parseGender(searchParams.get("gender"));
    const ageGroup = parseAgeGroup(searchParams.get("ageGroup") || searchParams.get("ageCategory"));
    const currentUserId = searchParams.get("currentUserId");
    const limit = safeParseInt(searchParams.get("limit"), 250, 1, 500);

    const minMatches = safeParseInt(searchParams.get("minMatches"), 0, 0, 9999);
    const minWinRate = safeParseInt(searchParams.get("minWinRate"), 0, 0, 100);
    const minPoints = safeParseInt(searchParams.get("minPoints"), 0, 0, 100000000);
    const maxPoints = safeParseInt(searchParams.get("maxPoints"), 100000000, 0, 100000000);
    const minRating = safeParseInt(searchParams.get("minRating"), 0, 0, 100000);
    const maxRating = safeParseInt(searchParams.get("maxRating"), 100000, 0, 100000);

    if (!sport || !["CORNHOLE", "DARTS"].includes(sport)) {
      return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
    }

    const cacheKey = generateCacheKeyFromParts(
      API_CACHE_PREFIXES.LEADERBOARD,
      sport,
      view,
      scope,
      region || "all",
      search || "",
      gender || "all",
      ageGroup || "all",
      sort,
      `mm:${minMatches}`,
      `mwr:${minWinRate}`,
      `minp:${minPoints}`,
      `maxp:${maxPoints}`,
      `minr:${minRating}`,
      `maxr:${maxRating}`,
      `limit:${limit}`,
      currentUserId || "no-user",
    );

    const cacheConfig = ENDPOINT_CACHE_CONFIGS.leaderboard;

    const result = await cacheResponse(request, cacheKey, cacheConfig, async () => {
      const baseWhere = buildRegisteredPlayersWhere(sport, {
        scope,
        region,
        search,
        gender,
        ageGroup,
      });

      const rankedWhere = buildRankedWhere(baseWhere, sport);
      const unrankedWhere = buildUnrankedWhere(baseWhere, sport);

      const [totalRegisteredPlayers, totalRankedPlayers, totalUnrankedPlayers, activeThisMonth, districts, states] =
        await Promise.all([
          db.user.count({ where: baseWhere }),
          db.user.count({ where: rankedWhere }),
          db.user.count({ where: unrankedWhere }),
          db.user.count({
            where: {
              AND: [
                baseWhere,
                {
                  rating: {
                    is: {
                      sport,
                      matchesPlayed: { gt: 0 },
                      updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                    },
                  },
                },
              ],
            },
          }),
          db.user.findMany({
            where: {
              AND: [
                { sport, isActive: true, isAnonymized: false },
                { district: { not: null } },
              ],
            },
            select: { district: true },
            distinct: ["district"],
          }),
          db.user.findMany({
            where: {
              AND: [
                { sport, isActive: true, isAnonymized: false },
                { state: { not: null } },
              ],
            },
            select: { state: true },
            distinct: ["state"],
          }),
        ]);

      const queryWhere = view === "ranked" ? rankedWhere : view === "unranked" ? unrankedWhere : baseWhere;

      const users = await db.user.findMany({
        where: queryWhere,
        include: { rating: true },
        take: limit,
        orderBy:
          view === "ranked"
            ? [{ visiblePoints: "desc" }, { hiddenElo: "desc" }, { createdAt: "asc" }]
            : [{ createdAt: "desc" }, { firstName: "asc" }, { lastName: "asc" }],
      });

      let rows = users.map((user, index) => {
        const matchesPlayed = user.rating?.matchesPlayed || 0;
        const wins = user.rating?.wins || 0;
        const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
        const ageGroupValue = getAgeGroupFromDob(user.dob);

        return {
          rank: view === "ranked" ? index + 1 : null,
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          city: user.city,
          state: user.state,
          district: user.district,
          location: getLocationLabel(user),
          gender: user.gender,
          genderLabel: getDisplayGender(user.gender),
          ageGroup: ageGroupValue,
          ageCategory: ageGroupValue,
          points: user.visiblePoints,
          rating: Math.round(user.hiddenElo),
          tier: getEloTier(user.hiddenElo, matchesPlayed),
          matches: matchesPlayed,
          matchesPlayed,
          wins,
          winRate,
          joinedOn: user.createdAt,
          joinedOnLabel: user.createdAt.toISOString(),
          status: getStatus(matchesPlayed),
        };
      });

      if (view === "ranked") {
        rows = rows.filter((row) => {
          if (row.matchesPlayed < minMatches) {
            return false;
          }
          if (row.winRate < minWinRate) {
            return false;
          }
          if (row.points < minPoints || row.points > maxPoints) {
            return false;
          }
          if (row.rating < minRating || row.rating > maxRating) {
            return false;
          }
          return true;
        });

        if (sort === "winRate") {
          rows.sort((a, b) => b.winRate - a.winRate || b.points - a.points);
        } else {
          rows.sort((a, b) => b.points - a.points || b.rating - a.rating);
        }

        rows = rows.map((row, index) => ({
          ...row,
          rank: index + 1,
        }));
      } else if (sort === "name_asc") {
        rows.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sort === "name_desc") {
        rows.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sort === "joinedOn_asc") {
        rows.sort((a, b) => new Date(a.joinedOnLabel).getTime() - new Date(b.joinedOnLabel).getTime());
      } else {
        rows.sort((a, b) => new Date(b.joinedOnLabel).getTime() - new Date(a.joinedOnLabel).getTime());
      }

      let currentUser = null;
      if (currentUserId) {
        const user = await db.user.findFirst({
          where: {
            id: currentUserId,
            sport,
            isActive: true,
            isAnonymized: false,
          },
          include: { rating: true },
        });

        if (user) {
          const matchesPlayed = user.rating?.matchesPlayed || 0;
          const points = user.visiblePoints || 0;
          const tier = getEloTier(user.hiddenElo, matchesPlayed);
          let rank: number | null = null;

          if (matchesPlayed > 0 && totalRankedPlayers > 0) {
            const playersAhead = await db.user.count({
              where: buildRankedWhere(
                {
                  sport,
                  isActive: true,
                  isAnonymized: false,
                  visiblePoints: { gt: points },
                },
                sport,
              ),
            });
            rank = playersAhead + 1;
          }

          currentUser = {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`.trim(),
            matchesPlayed,
            points,
            rating: Math.round(user.hiddenElo),
            rank,
            tier,
            rankChange: null,
          };
        }
      }

      return {
        leaderboard: rows,
        players: rows,
        view,
        total: rows.length,
        totalRegisteredPlayers,
        totalRankedPlayers,
        totalUnrankedPlayers,
        activeThisMonth,
        currentUser,
        stats: {
          totalPlayers: totalRegisteredPlayers,
          totalRegisteredPlayers,
          totalRankedPlayers,
          totalUnrankedPlayers,
          activeThisMonth,
          topPlayer: totalRankedPlayers > 0 ? rows[0]?.name || null : null,
          topPlayerCity: totalRankedPlayers > 0 ? rows[0]?.city || null : null,
        },
        filters: {
          districts: districts.map((item) => item.district).filter(Boolean) as string[],
          states: states.map((item) => item.state).filter(Boolean) as string[],
          genders: ["MALE", "FEMALE", "OTHER"],
          ageGroups: ["JUNIOR", "ADULT", "MASTERS"],
          ageCategories: ["JUNIOR", "ADULT", "MASTERS"],
        },
      };
    });

    const response = NextResponse.json(result.data);
    return addCacheHeaders(response, result.fromCache, result.ttlRemaining, cacheConfig.ttl, result.isStale);
  } catch (error) {
    log.errorWithStack("Error fetching leaderboard", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
