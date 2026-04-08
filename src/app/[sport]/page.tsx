import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, MapPin, TrendingUp, ChevronRight, Target, Users, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import SiteFooter from "@/components/layout/site-footer";
import { SportAuthOverlay } from "@/components/auth/sport-auth-overlay";
import { db } from "@/lib/db";
import { SportType } from "@prisma/client";

export default async function SportHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string }>;
  searchParams?: Promise<{ auth?: string }>;
}) {
  const { sport } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const authView =
    resolvedSearchParams?.auth === "login" || resolvedSearchParams?.auth === "register"
      ? resolvedSearchParams.auth
      : null;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";
  const sportType = isCornhole ? SportType.CORNHOLE : SportType.DARTS;
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";
  const gradientClass = isCornhole
    ? "from-green-500 to-emerald-600"
    : "from-teal-500 to-cyan-600";
  const heroImage = isCornhole
    ? "/images/hero/cornhole/action-shot.png"
    : "/images/hero/darts/action-shot.png";
  const tournamentImage = isCornhole
    ? "/images/hero/cornhole/tournament-scene.png"
    : "/images/hero/darts/tournament-scene.png";

  const tournaments = await (async () => {
    try {
      return await db.tournament.findMany({
        where: {
          sport: sportType,
          isPublic: true,
        },
        orderBy: { startDate: "asc" },
        take: 4,
        include: {
          _count: {
            select: { registrations: true },
          },
        },
      });
    } catch (error) {
      console.error("Unable to load tournaments for sport homepage", error);
      return [];
    }
  })();

  const topPlayers = await (async () => {
    try {
      return await db.user.findMany({
        where: {
          sport: sportType,
          showOnLeaderboard: true,
          isActive: true,
        },
        orderBy: { visiblePoints: "desc" },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          hiddenElo: true,
          visiblePoints: true,
        },
      });
    } catch (error) {
      console.error("Unable to load leaderboard preview for sport homepage", error);
      return [];
    }
  })();

  const [tournamentCount, playerCount, cityCount, prizePoolTotal] = await (async () => {
    try {
      return await Promise.all([
        db.tournament.count({
          where: { sport: sportType },
        }),
        db.user.count({
          where: { sport: sportType, isActive: true },
        }),
        db.city.count({
          where: { sport: sportType },
        }),
        db.tournament
          .aggregate({
            where: { sport: sportType },
            _sum: { prizePool: true },
          })
          .then((result) => result._sum.prizePool ?? 0),
      ]);
    } catch (error) {
      console.error("Unable to load homepage stats", error);
      return [0, 0, 0, 0] as const;
    }
  })();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatDate = (dateStr: Date) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      <SportAuthOverlay sport={sport} initialView={authView} />
      <section className="relative py-8 sm:py-12 lg:py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
            <div className="order-1 lg:order-2">
              <div className="relative aspect-[16/9] sm:aspect-[4/3] w-full rounded-xl overflow-hidden shadow-2xl">
                <img
                  src={heroImage}
                  alt={`${sportName} action shot`}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${gradientClass} opacity-30`} />
              </div>
            </div>

            <div className="order-2 lg:order-1 max-w-xl">
              <Badge
                variant="outline"
                className={cn(
                  "mb-4 border-current/30",
                  isCornhole ? "border-green-500 text-green-600" : "border-teal-500 text-teal-600",
                )}
              >
                <Target className="w-3 h-3 mr-1" />
                {sportName}
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                {sportName} Tournaments
                <br />
                <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", gradientClass)}>
                  Across India
                </span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Compete in {sportName.toLowerCase()} tournaments from city to national level.
                Track your progress with our dual rating system and climb the leaderboards.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href={`/${sport}?auth=register`}>
                  <Button size="lg" className={cn("text-white shadow-sm gap-2", primaryBtnClass)}>
                    <Trophy className="w-5 h-5" />
                    Start Competing
                  </Button>
                </Link>
                <Link href={`/${sport}/tournaments`}>
                  <Button size="lg" variant="outline" className="gap-2">
                    <Calendar className="w-5 h-5" />
                    View Tournaments
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={cn("py-8 px-4", isCornhole ? "bg-green-50 dark:bg-green-950/20" : "bg-teal-50 dark:bg-teal-950/20")}>
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <Trophy className={cn("w-8 h-8 mx-auto mb-2", isCornhole ? "text-green-600" : "text-teal-600")} />
              <p className="text-2xl font-bold text-foreground">{tournamentCount}</p>
              <p className="text-sm text-muted-foreground">Tournaments</p>
            </div>
            <div className="text-center">
              <Users className={cn("w-8 h-8 mx-auto mb-2", isCornhole ? "text-green-600" : "text-teal-600")} />
              <p className="text-2xl font-bold text-foreground">{playerCount}</p>
              <p className="text-sm text-muted-foreground">Players</p>
            </div>
            <div className="text-center">
              <MapPin className={cn("w-8 h-8 mx-auto mb-2", isCornhole ? "text-green-600" : "text-teal-600")} />
              <p className="text-2xl font-bold text-foreground">{cityCount}</p>
              <p className="text-sm text-muted-foreground">Cities</p>
            </div>
            <div className="text-center">
              <Award className={cn("w-8 h-8 mx-auto mb-2", isCornhole ? "text-green-600" : "text-teal-600")} />
              <p className="text-2xl font-bold text-foreground">
                {prizePoolTotal > 0 ? formatCurrency(prizePoolTotal) : "Not announced"}
              </p>
              <p className="text-sm text-muted-foreground">Prize Pool</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-background">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Upcoming Tournaments</h2>
            <Link href={`/${sport}/tournaments`}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {tournaments.length === 0 ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p className="font-medium text-foreground">No public tournaments are listed right now.</p>
                <p className="mt-1 text-sm">Check back later or browse the tournaments directory for updates.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {tournaments.map((tournament) => (
                <Link key={tournament.id} href={`/${sport}/tournaments/${tournament.id}`}>
                  <Card className="border-border overflow-hidden hover:shadow-lg transition-shadow h-full">
                    <div className="relative h-40">
                      <img
                        src={tournamentImage}
                        alt={tournament.name}
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${gradientClass} opacity-40`} />
                      <Badge className="absolute top-2 right-2" variant="secondary">
                        {tournament.scope}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-1">{tournament.name}</h3>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(tournament.startDate)}</span>
                        </div>
                        {tournament.city && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            <span>{tournament.city}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <span className="text-sm font-medium text-green-600">
                          {tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : "Free"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tournament._count.registrations}/{tournament.maxPlayers} joined
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-muted/30 border-y border-border">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Top Players</h2>
            <Link href={`/${sport}/leaderboard`}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                Full Leaderboard <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {topPlayers.length === 0 ? (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-0">
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No leaderboard entries are available yet.</p>
                  <p className="text-sm">Player rankings will appear here once results are recorded.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {topPlayers.map((player, index) => (
                    <Link
                      key={player.id}
                      href={`/${sport}/players/${player.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                          index === 0
                            ? "bg-yellow-500/10 text-yellow-600"
                            : index === 1
                              ? "bg-gray-500/10 text-gray-600"
                              : index === 2
                                ? "bg-orange-500/10 text-orange-600"
                                : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{player.firstName} {player.lastName}</p>
                        <p className="text-sm text-muted-foreground">
                          {player.visiblePoints} points
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-bold", isCornhole ? "text-green-600" : "text-teal-600")}>
                          {player.visiblePoints} pts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Elo: {Math.round(player.hiddenElo)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-background">
        <div className="container mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Why Compete Here?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="border-border text-center hover:shadow-lg transition-shadow bg-card">
              <CardContent className="p-6">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-4",
                    isCornhole
                      ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                      : "bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800",
                  )}
                >
                  <TrendingUp className={cn("w-6 h-6", isCornhole ? "text-green-600" : "text-teal-600")} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Dual Rating System</h3>
                <p className="text-sm text-muted-foreground">Hidden Elo for seeding, visible points for achievements</p>
              </CardContent>
            </Card>
            <Card className="border-border text-center hover:shadow-lg transition-shadow bg-card">
              <CardContent className="p-6">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-4",
                    isCornhole
                      ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                      : "bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800",
                  )}
                >
                  <MapPin className={cn("w-6 h-6", isCornhole ? "text-green-600" : "text-teal-600")} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Geographic Tiers</h3>
                <p className="text-sm text-muted-foreground">Compete at city, district, state, and national levels</p>
              </CardContent>
            </Card>
            <Card className="border-border text-center hover:shadow-lg transition-shadow bg-card">
              <CardContent className="p-6">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-4",
                    isCornhole
                      ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                      : "bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800",
                  )}
                >
                  <Trophy className={cn("w-6 h-6", isCornhole ? "text-green-600" : "text-teal-600")} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Real Prizes</h3>
                <p className="text-sm text-muted-foreground">Win cash prizes and earn recognition</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className={cn("py-12 px-4", isCornhole ? "bg-green-600" : "bg-teal-600")}>
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Start Competing?
          </h2>
          <p className="text-white/90 mb-6 max-w-xl mx-auto">
            Join {sportName} tournaments today and climb the ranks!
          </p>
          <Link href={`/${sport}/register`}>
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 shadow-lg">
              <Trophy className="mr-2 h-5 w-5" />
              Register Now
            </Button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
