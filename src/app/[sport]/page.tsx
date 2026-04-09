import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SiteFooter from "@/components/layout/site-footer";
import { SportAuthOverlay } from "@/components/auth/sport-auth-overlay";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { SportType } from "@prisma/client";
import {
  ArrowRight,
  Award,
  Calendar,
  ChevronRight,
  Flag,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

type SportPageProps = {
  params: Promise<{ sport: string }>;
  searchParams?: Promise<{ auth?: string }>;
};

type SportVisual = {
  src?: string;
  eyebrow: string;
  title: string;
  description: string;
};

export default async function SportHomePage({ params, searchParams }: SportPageProps) {
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
  const softAccentClass = isCornhole
    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900"
    : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900";
  const accentTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const accentBorderClass = isCornhole ? "border-green-200/70" : "border-teal-200/70";
  const gradientClass = isCornhole
    ? "from-green-500 to-emerald-600"
    : "from-teal-500 to-cyan-600";
  const heroGlowClass = isCornhole
    ? "from-green-500/20 via-emerald-400/10 to-transparent"
    : "from-teal-500/20 via-cyan-400/10 to-transparent";
  const statTintClass = isCornhole
    ? "from-green-500/8 to-emerald-500/12"
    : "from-teal-500/8 to-cyan-500/12";

  const visuals: SportVisual[] = isCornhole
    ? [
        {
          src: "/images/hero/cornhole/action-shot.png",
          eyebrow: "Live Competition",
          title: "Real match-day action",
          description: "Structured fixtures, seeded brackets, and verified results from active cornhole events.",
        },
        {
          src: "/images/hero/cornhole/tournament-scene.png",
          eyebrow: "Tournament View",
          title: "Tournaments worth showing up for",
          description: "Clear schedules, entry visibility, and formats that help players understand what they are joining.",
        },
        {
          src: "/images/hero/cornhole/trophy-presentation.png",
          eyebrow: "Progression",
          title: "Recognition beyond one event",
          description: "Rankings, trophies, and repeat play that help players keep progressing through the season.",
        },
      ]
    : [
        {
          src: "/images/hero/darts/action-shot.png",
          eyebrow: "Live Competition",
          title: "Precision under pressure",
          description: "Competitive darts environments with standings, schedule visibility, and reliable result tracking.",
        },
        {
          src: "/images/hero/darts/tournament-scene.png",
          eyebrow: "Tournament View",
          title: "Structured events across cities",
          description: "From local fixtures to bigger city-level events, the layout is built for clarity and repeat play.",
        },
        {
          src: "/images/hero/darts/dartboard-closeup.png",
          eyebrow: "Progression",
          title: "Performance that compounds",
          description: "Each result feeds into visible points and long-term competitive progress.",
        },
      ];

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
        db.tournament.count({ where: { sport: sportType } }),
        db.user.count({ where: { sport: sportType, isActive: true } }),
        db.city.count({ where: { sport: sportType } }),
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount / 100);

  const formatDate = (dateStr: Date) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const quickHighlights = [
    {
      icon: ShieldCheck,
      title: "Verified results",
      description: "Match outcomes recorded reliably.",
    },
    {
      icon: Calendar,
      title: "Tournament visibility",
      description: "Format, fee, and location upfront.",
    },
    {
      icon: TrendingUp,
      title: "Rank progression",
      description: "Points and Elo stay visible.",
    },
  ];

  const competitionFlow = [
    "Find tournaments",
    "Register for the right event",
    "Play and move up the rankings",
  ];

  const featureShowcase = [
    { icon: Trophy, title: "Structured tournaments", description: "Recurring events across levels." },
    { icon: Users, title: "Player rankings", description: "See where you stand." },
    { icon: MapPin, title: "City discovery", description: "Browse active locations." },
    { icon: Award, title: "Competitive progress", description: "Build momentum over time." },
  ];

  return (
    <>
      <SportAuthOverlay sport={sport} initialView={authView} />

      <section className="relative overflow-hidden px-4 pb-8 pt-8 sm:pb-12 sm:pt-10">
        <div className={cn("absolute inset-x-0 top-0 h-72 bg-gradient-to-b", heroGlowClass)} />
        <div className="container mx-auto relative">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:gap-10">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge variant="outline" className={cn("gap-2 border-current/30 px-3 py-1", softAccentClass)}>
                  <Target className="h-3.5 w-3.5" />
                  {sportName} Competition Hub
                </Badge>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                    Play {sportName.toLowerCase()} in a system that feels organized, competitive, and worth coming back to.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    Join tournaments, follow rankings, and track your progress.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href={`/${sport}?auth=register`}>
                  <Button size="lg" className={cn("gap-2 text-white shadow-sm", primaryBtnClass)}>
                    Join {sportName} Events
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/${sport}/tournaments`}>
                  <Button size="lg" variant="outline" className="gap-2">
                    Browse Tournaments
                    <Calendar className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {quickHighlights.map((item) => (
                  <Card key={item.title} className="border-border/70 bg-card/90 backdrop-blur-sm">
                    <CardContent className="p-5">
                      <div className={cn("mb-3 inline-flex rounded-xl border p-2.5", softAccentClass)}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <h2 className="mb-1.5 font-semibold text-foreground">{item.title}</h2>
                      <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className={cn("grid gap-4 rounded-2xl border bg-gradient-to-r p-5 md:grid-cols-4", accentBorderClass, statTintClass)}>
                <MetricCard label="Tournaments" value={tournamentCount.toString()} accentClass={accentTextClass} />
                <MetricCard label="Players" value={playerCount.toString()} accentClass={accentTextClass} />
                <MetricCard label="Cities" value={cityCount.toString()} accentClass={accentTextClass} />
                <MetricCard
                  label="Prize Pool"
                  value={prizePoolTotal > 0 ? formatCurrency(prizePoolTotal) : "TBA"}
                  accentClass={accentTextClass}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-rows-[1.3fr_1fr]">
              <VisualPanel visual={visuals[0]} gradientClass={gradientClass} />
              <div className="grid gap-4 sm:grid-cols-2">
                <VisualPanel visual={visuals[1]} gradientClass={gradientClass} compact />
                <VisualPanel visual={visuals[2]} gradientClass={gradientClass} compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:py-14">
        <div className="container mx-auto">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>
                Competition Flow
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">How the system works</h2>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/70 bg-card">
              <CardContent className="grid gap-4 p-6 md:grid-cols-3">
                {competitionFlow.map((step, index) => (
                  <div key={step} className="rounded-2xl border border-border/60 bg-muted/30 p-5">
                    <div className={cn("mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold", softAccentClass)}>
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-foreground">{step}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">What you can do here</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {featureShowcase.map((item) => (
                  <div key={item.title} className="rounded-xl border border-border/60 bg-muted/25 p-4">
                    <div className={cn("mb-3 inline-flex rounded-lg border p-2", softAccentClass)}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/30 px-4 py-10 sm:py-14">
        <div className="container mx-auto">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>
                Upcoming Tournaments
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Events you can evaluate at a glance</h2>
            </div>
            <Link href={`/${sport}/tournaments`}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                View all tournaments
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {tournaments.length === 0 ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <Card className="border-border/70 bg-card">
                <CardContent className="space-y-4 p-6">
                  <Skeleton className="h-52 w-full rounded-2xl" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card">
                <CardContent className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <Calendar className="mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="font-medium text-foreground">No public tournaments are listed right now.</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    When new events go live, they will appear here with their location, date, format, and current registration progress.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {tournaments.map((tournament, index) => (
                <Link key={tournament.id} href={`/${sport}/tournaments/${tournament.id}`} className="group h-full">
                  <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative h-44 overflow-hidden">
                      <VisualImage
                        src={visuals[index % visuals.length]?.src}
                        alt={tournament.name}
                        gradientClass={gradientClass}
                      />
                      <Badge className="absolute left-3 top-3" variant="secondary">
                        {tournament.scope}
                      </Badge>
                    </div>
                    <CardContent className="flex flex-1 flex-col p-5">
                      <div className="mb-4 space-y-2">
                        <h3 className="line-clamp-2 text-lg font-semibold text-foreground">{tournament.name}</h3>
                        <div className="space-y-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(tournament.startDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="line-clamp-1">
                              {tournament.city || tournament.district || tournament.state || "Venue to be announced"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Entry</p>
                          <p className={cn("font-semibold", accentTextClass)}>
                            {tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : "Free"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Registered</p>
                          <p className="font-semibold text-foreground">
                            {tournament._count.registrations}/{tournament.maxPlayers}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-10 sm:py-14">
        <div className="container mx-auto">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-border/70 bg-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                <div>
                  <Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>
                    Leaderboard Preview
                  </Badge>
                  <CardTitle className="text-2xl">Who is setting the pace right now</CardTitle>
                </div>
                <Link href={`/${sport}/leaderboard`}>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    Full leaderboard
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {topPlayers.length === 0 ? (
                  <div className="p-6">
                    <div className="grid gap-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="flex items-center gap-4 rounded-2xl border border-border/60 p-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {topPlayers.map((player, index) => (
                      <Link
                        key={player.id}
                        href={`/${sport}/players/${player.id}`}
                        className="flex items-center gap-4 p-5 transition-colors hover:bg-muted/40"
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                            index === 0
                              ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                              : index === 1
                                ? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                                : index === 2
                                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {player.firstName} {player.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">Elo {Math.round(player.hiddenElo)}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-semibold", accentTextClass)}>{player.visiblePoints} pts</p>
                          <p className="text-xs text-muted-foreground">Visible ranking points</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5">
              <Card className="border-border/70 bg-card">
                <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
                  <CompetitionPillar
                    icon={Flag}
                    title="Competition levels"
                    description="Local to higher-stage play."
                    accentClass={softAccentClass}
                  />
                  <CompetitionPillar
                    icon={Sparkles}
                    title="Clear event context"
                    description="Date, place, and format visible."
                    accentClass={softAccentClass}
                  />
                  <CompetitionPillar
                    icon={Trophy}
                    title="Visible momentum"
                    description="Rankings keep moving."
                    accentClass={softAccentClass}
                  />
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-border/70 bg-card">
                <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                  <CardContent className="p-6">
                    <Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>
                      Why Compete Here
                    </Badge>
                    <h3 className="text-2xl font-bold text-foreground">Built for repeat competition.</h3>
                    <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                      <li className="flex gap-3">
                        <ShieldCheck className={cn("mt-0.5 h-4 w-4 shrink-0", accentTextClass)} />
                        Verified match results.
                      </li>
                      <li className="flex gap-3">
                        <Users className={cn("mt-0.5 h-4 w-4 shrink-0", accentTextClass)} />
                        Rankings and player visibility.
                      </li>
                      <li className="flex gap-3">
                        <Award className={cn("mt-0.5 h-4 w-4 shrink-0", accentTextClass)} />
                        Stable visual slots for media.
                      </li>
                    </ul>
                  </CardContent>
                  <div className="border-t border-border/60 md:border-l md:border-t-0">
                    <VisualPanel
                      visual={{
                        eyebrow: "Media Slot",
                        title: `${sportName} presentation area`,
                        description: "This space is reserved for real sport imagery and stays visually stable even when assets are still being prepared.",
                      }}
                      gradientClass={gradientClass}
                      compact={false}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className={cn("px-4 py-12", isCornhole ? "bg-green-600" : "bg-teal-600")}>
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Ready to step into {sportName.toLowerCase()} competition?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
            Join upcoming events, follow the leaderboard, and keep your competitive profile moving.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/${sport}?auth=register`}>
              <Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100">
                Register Now
              </Button>
            </Link>
            <Link href={`/${sport}/leaderboard`}>
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                View Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function MetricCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/80 p-4 text-left backdrop-blur-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold", accentClass)}>{value}</p>
    </div>
  );
}

function CompetitionPillar({
  icon: Icon,
  title,
  description,
  accentClass,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/25 p-5">
      <div className={cn("mb-3 inline-flex rounded-xl border p-2.5", accentClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-1.5 font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function VisualPanel({
  visual,
  gradientClass,
  compact = false,
}: {
  visual: SportVisual;
  gradientClass: string;
  compact?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 backdrop-blur-sm">
      <div className={cn("grid h-full", compact ? "grid-rows-[1fr_auto]" : "grid-rows-[1.2fr_auto]")}>
        <div className={cn("relative", compact ? "min-h-[180px]" : "min-h-[260px]")}>
          <VisualImage src={visual.src} alt={visual.title} gradientClass={gradientClass} />
        </div>
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{visual.eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">{visual.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{visual.description}</p>
        </CardContent>
      </div>
    </Card>
  );
}

function VisualImage({
  src,
  alt,
  gradientClass,
}: {
  src?: string;
  alt: string;
  gradientClass: string;
}) {
  if (!src) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-muted/40">
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-35", gradientClass)} />
        <div className="absolute inset-0 p-6">
          <Skeleton className="h-full w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <div className={cn("absolute inset-0 bg-gradient-to-t opacity-35", gradientClass)} />
    </>
  );
}
