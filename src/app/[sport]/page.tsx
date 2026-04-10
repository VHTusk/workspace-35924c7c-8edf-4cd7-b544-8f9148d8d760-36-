import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SiteFooter from "@/components/layout/site-footer";
import { SportAuthOverlay } from "@/components/auth/sport-auth-overlay";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { buildLeaderboardEligibleUserWhere } from "@/lib/user-sport";
import { SportType } from "@prisma/client";
import { ArrowRight, Calendar, ChevronRight, MapPin, Medal, PlayCircle, ShieldCheck, Trophy, Users } from "lucide-react";

type Props = {
  params: Promise<{ sport: string }>;
  searchParams?: Promise<{ auth?: string }>;
};

type SportConfig = {
  eyebrow: string;
  headline: string;
  subheading: string;
  introTitle: string;
  introLines: string[];
  heroImage: string;
  demoImage: string;
  mediaImages: string[];
  accentClass: string;
  accentTextClass: string;
  accentButtonClass: string;
  accentSurfaceClass: string;
  finalHeading: string;
};

export default async function SportHomePage({ params, searchParams }: Props) {
  const { sport } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const authView = resolvedSearchParams?.auth === "login" || resolvedSearchParams?.auth === "register" ? resolvedSearchParams.auth : null;
  const isCornhole = sport === "cornhole";
  const sportType = isCornhole ? SportType.CORNHOLE : SportType.DARTS;
  const sportName = isCornhole ? "Cornhole" : "Darts";
  const now = new Date();

  const config: SportConfig = isCornhole
    ? {
        eyebrow: "Cornhole Competition",
        headline: "Play Competitive Cornhole Across India",
        subheading: "Structured tournaments. Verified results. District to national rankings.",
        introTitle: "What is Cornhole",
        introLines: [
          "Throw bags onto a raised board placed 27 ft away.",
          "Score 3 points for the hole and 1 point for the board.",
        ],
        heroImage: "/images/hero/cornhole/action-shot.png",
        demoImage: "/images/hero/cornhole/tournament-scene.png",
        mediaImages: [
          "/images/hero/cornhole/action-shot.png",
          "/images/hero/cornhole/tournament-scene.png",
          "/images/hero/cornhole/trophy-presentation.png",
        ],
        accentClass: "border-green-200/70 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300",
        accentTextClass: "text-green-700 dark:text-green-300",
        accentButtonClass: "bg-green-600 text-white hover:bg-green-700",
        accentSurfaceClass: "from-green-500/10 via-emerald-500/6 to-transparent",
        finalHeading: "Start Competing in Cornhole",
      }
    : {
        eyebrow: "Darts Competition",
        headline: "Play Competitive Darts Across India",
        subheading: "Structured tournaments. Verified results. District to national rankings.",
        introTitle: "What is Darts",
        introLines: [
          "Players throw three darts per turn at a standard target.",
          "Scoring rewards precision, consistency, and match control.",
        ],
        heroImage: "/images/hero/darts/action-shot.png",
        demoImage: "/images/hero/darts/tournament-scene.png",
        mediaImages: [
          "/images/hero/darts/action-shot.png",
          "/images/hero/darts/tournament-scene.png",
          "/images/hero/darts/dartboard-closeup.png",
        ],
        accentClass: "border-teal-200/70 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300",
        accentTextClass: "text-teal-700 dark:text-teal-300",
        accentButtonClass: "bg-teal-600 text-white hover:bg-teal-700",
        accentSurfaceClass: "from-teal-500/10 via-cyan-500/6 to-transparent",
        finalHeading: "Start Competing in Darts",
      };

  const [
    upcomingTournaments,
    topPlayers,
    playerCount,
    totalMatchCount,
    districtRows,
    completedTournamentCount,
    totalTournamentCount,
  ] = await Promise.all([
    db.tournament.findMany({
      where: { sport: sportType, isPublic: true, endDate: { gte: now } },
      orderBy: { startDate: "asc" },
      take: 3,
      include: { _count: { select: { registrations: true } } },
    }).catch((error) => {
      console.error("sport home tournaments", error);
      return [];
    }),
    db.user.findMany({
      where: buildLeaderboardEligibleUserWhere(sportType, { requirePublic: true }),
      orderBy: [{ visiblePoints: "desc" }, { hiddenElo: "desc" }],
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        visiblePoints: true,
        rating: {
          select: {
            matchesPlayed: true,
            wins: true,
          },
        },
      },
    }).catch((error) => {
      console.error("sport home players", error);
      return [];
    }),
    db.user.count({
      where: { sport: sportType, isActive: true, isAnonymized: false },
    }).catch((error) => {
      console.error("sport home player count", error);
      return 0;
    }),
    db.match.count({
      where: { sport: sportType },
    }).catch((error) => {
      console.error("sport home match count", error);
      return 0;
    }),
    db.tournament.findMany({
      where: { sport: sportType, district: { not: null } },
      select: { district: true },
      distinct: ["district"],
    }).catch((error) => {
      console.error("sport home districts", error);
      return [];
    }),
    db.tournament.count({
      where: { sport: sportType, endDate: { lt: now } },
    }).catch((error) => {
      console.error("sport home completed tournaments", error);
      return 0;
    }),
    db.tournament.count({
      where: { sport: sportType },
    }).catch((error) => {
      console.error("sport home total tournaments", error);
      return 0;
    }),
  ]);

  const stats = [
    { label: "Players Registered", value: formatCompactNumber(playerCount) },
    { label: "Matches Played", value: formatCompactNumber(totalMatchCount) },
    { label: "Active Districts", value: formatCompactNumber(districtRows.length) },
    { label: "Tournaments Conducted", value: formatCompactNumber(completedTournamentCount || totalTournamentCount) },
  ];

  const structureStages = [
    {
      title: "District",
      summary: "Local entry point",
      detail: "Join published district events and start building official results.",
    },
    {
      title: "State",
      summary: "Qualified competition",
      detail: "Progress through tournament performance and verified rankings.",
    },
    {
      title: "National",
      summary: "Top level stage",
      detail: "The strongest state performers move into national competition.",
    },
  ];

  const steps = [
    "Register",
    `Join ${sportName}`,
    "Enter Tournament",
    "Play Matches",
    "Get Ranked",
  ];

  const valueCards = [
    {
      icon: ShieldCheck,
      title: "Verified Results",
      description: "Official match outcomes are recorded against your profile.",
    },
    {
      icon: Trophy,
      title: "Ranking Progression",
      description: "Each official result helps shape your competitive standing.",
    },
    {
      icon: Medal,
      title: "Higher Level Qualification",
      description: "District play creates the path to state and national stages.",
    },
  ];

  return (
    <>
      <SportAuthOverlay sport={sport} initialView={authView} />

      <main className="bg-background">
        <section className="px-4 pb-8 pt-8 sm:pb-10 sm:pt-10">
          <div className="container mx-auto">
            <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
              <div className="space-y-6">
                <div className="space-y-4">
                  <Badge variant="outline" className={cn("px-3 py-1", config.accentClass)}>
                    {config.eyebrow}
                  </Badge>
                  <div className="space-y-3">
                    <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                      {config.headline}
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                      {config.subheading}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/${sport}/tournaments`}>
                    <Button size="lg" className={cn("gap-2", config.accentButtonClass)}>
                      Join Tournament
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/${sport}/leaderboard`}>
                    <Button size="lg" variant="outline" className="gap-2">
                      View Leaderboard
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
                <div className="relative aspect-[16/10]">
                  <Image src={config.heroImage} alt={`${sportName} competition`} fill className="object-cover" priority />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                    <div className="max-w-md rounded-2xl border border-white/15 bg-black/35 p-4 text-white backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                        Official Competition
                      </p>
                      <p className="mt-2 text-xl font-semibold">Tournament play, rankings, and verified results.</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="px-4 pb-8">
          <div className="container mx-auto">
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-card px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                  <p className={cn("mt-2 text-2xl font-semibold", config.accentTextClass)}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:py-10">
          <div className="container mx-auto">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-4">
                <SectionEyebrow label={config.introTitle} accentClass={config.accentClass} />
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Simple to learn. Serious to compete in.</h2>
                <div className="space-y-3 text-base leading-7 text-muted-foreground">
                  {config.introLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>

              <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
                <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
                  <div className="relative min-h-[240px]">
                    <Image src={config.demoImage} alt={`${sportName} gameplay`} fill className="object-cover" />
                  </div>
                  <CardContent className="flex flex-col justify-center p-6">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                      <PlayCircle className="h-3.5 w-3.5" />
                      Gameplay basics
                    </div>
                    <p className="mt-4 text-lg font-semibold text-foreground">A skill sport built on consistency, control, and match composure.</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Enter tournament play, record official results, and move through ranked competition over time.
                    </p>
                  </CardContent>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:py-10">
          <div className="container mx-auto space-y-6">
            <SectionHeader
              eyebrow="Competition Structure"
              title="District to national progression"
              description="A clear pathway from local play to higher-level competition."
              accentClass={config.accentClass}
            />

            <div className="grid gap-5 lg:grid-cols-3">
              {structureStages.map((stage, index) => (
                <Card key={stage.title} className="border-border/70 bg-card shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]", config.accentClass)}>
                        Stage {index + 1}
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{stage.summary}</p>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-foreground">{stage.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{stage.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/20 px-4 py-10 sm:py-12">
          <div className="container mx-auto space-y-6">
            <SectionHeader
              eyebrow="Tournaments"
              title="Published events"
              description="Find upcoming Cornhole events, check entry details, and reserve your spot."
              accentClass={config.accentClass}
              action={
                <Link href={`/${sport}/tournaments`}>
                  <Button variant="ghost" className="gap-2">
                    View all tournaments
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              }
            />

            {upcomingTournaments.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-3">
                {upcomingTournaments.map((tournament) => {
                  const slotsLeft = Math.max(0, tournament.maxPlayers - tournament._count.registrations);

                  return (
                    <Card key={tournament.id} className="border-border/70 bg-card shadow-sm">
                      <CardContent className="flex h-full flex-col p-6">
                        <div className="space-y-3">
                          <h3 className="text-xl font-semibold text-foreground">{tournament.name}</h3>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{getTournamentLocation(tournament.district, tournament.state)}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{formatDate(tournament.startDate)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
                          <TournamentMeta label="Entry Fee" value={tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : "Free"} />
                          <TournamentMeta label="Slots Left" value={String(slotsLeft)} />
                        </div>

                        <Link href={`/${sport}/tournaments/${tournament.id}`} className="mt-5">
                          <Button variant="outline" className="w-full gap-2">
                            Enter Tournament
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyStateCard
                title="No tournaments are scheduled yet."
                description="Registrations will appear here once events are published."
                actionLabel="Browse Tournaments"
                href={`/${sport}/tournaments`}
              />
            )}
          </div>
        </section>

        <section className="px-4 py-10 sm:py-12">
          <div className="container mx-auto space-y-6">
            <SectionHeader
              eyebrow="Leaderboard"
              title="Top ranked players"
              description="Official rankings based on recorded matches and visible competition points."
              accentClass={config.accentClass}
              action={
                <Link href={`/${sport}/leaderboard`}>
                  <Button variant="ghost" className="gap-2">
                    View full leaderboard
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              }
            />

            <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
              {topPlayers.length > 0 ? (
                <div>
                  <div className="hidden grid-cols-[88px_minmax(0,1fr)_96px_96px_96px] gap-4 border-b border-border/60 px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
                    <span>Rank</span>
                    <span>Player Name</span>
                    <span>Matches</span>
                    <span>Win %</span>
                    <span>Points</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {topPlayers.map((player, index) => {
                      const matches = player.rating?.matchesPlayed ?? 0;
                      const wins = player.rating?.wins ?? 0;
                      const winRate = getWinRate(matches, wins);

                      return (
                        <Link
                          key={player.id}
                          href={`/${sport}/players/${player.id}`}
                          className="grid gap-2 px-6 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[88px_minmax(0,1fr)_96px_96px_96px] md:items-center md:gap-4"
                        >
                          <div className={cn("text-sm font-semibold", config.accentTextClass)}>#{index + 1}</div>
                          <div className="font-medium text-foreground">
                            {player.firstName} {player.lastName}
                          </div>
                          <DataCell label="Matches" value={String(matches)} />
                          <DataCell label="Win %" value={`${winRate}%`} />
                          <DataCell label="Points" value={String(player.visiblePoints)} />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <CardContent className="p-6">
                  <p className="text-lg font-semibold text-foreground">Rankings will appear after official matches are recorded.</p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Once match results are submitted, this section will start showing the top Cornhole players.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        </section>

        <section className="px-4 py-10 sm:py-12">
          <div className="container mx-auto space-y-6">
            <SectionHeader
              eyebrow="How It Works"
              title="Start in five steps"
              description="A simple path from account setup to official ranking."
              accentClass={config.accentClass}
            />

            <div className="grid gap-4 md:grid-cols-5">
              {steps.map((step, index) => (
                <Card key={step} className="border-border/70 bg-card shadow-sm">
                  <CardContent className="p-5">
                    <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", config.accentTextClass)}>
                      Step {index + 1}
                    </p>
                    <p className="mt-3 text-base font-semibold text-foreground">{step}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/20 px-4 py-10 sm:py-12">
          <div className="container mx-auto space-y-6">
            <SectionHeader
              eyebrow="Gameplay"
              title="From real events"
              description="Photos and clips from competitive play help establish the official feel of the sport."
              accentClass={config.accentClass}
            />

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
                <div className="relative aspect-[16/10]">
                  <Image src={config.mediaImages[0]} alt={`${sportName} action`} fill className="object-cover" />
                </div>
              </Card>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {config.mediaImages.slice(1).map((src, index) => (
                  <Card key={src} className="overflow-hidden border-border/70 bg-card shadow-sm">
                    <div className="relative aspect-[16/10] lg:aspect-[16/9]">
                      <Image src={src} alt={`${sportName} media ${index + 2}`} fill className="object-cover" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:py-12">
          <div className="container mx-auto space-y-6">
            <SectionHeader
              eyebrow="Why Compete"
              title="Why players return"
              description="The system is built for repeat competition, visible progress, and meaningful advancement."
              accentClass={config.accentClass}
            />

            <div className="grid gap-5 lg:grid-cols-3">
              {valueCards.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="border-border/70 bg-card shadow-sm">
                  <CardContent className="p-6">
                    <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl border", config.accentClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:py-14">
          <div className="container mx-auto">
            <div className={cn("overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-r p-8 shadow-sm sm:p-10", config.accentSurfaceClass)}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <Badge variant="outline" className={cn("mb-3 px-3 py-1", config.accentClass)}>
                    Ready to start
                  </Badge>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{config.finalHeading}</h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    Create your profile, enter official tournaments, and start building your ranking.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/${sport}/tournaments`}>
                    <Button size="lg" className={cn("gap-2", config.accentButtonClass)}>
                      Join Tournament
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/${sport}?auth=register`}>
                    <Button size="lg" variant="outline">
                      Create Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  accentClass,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accentClass: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <SectionEyebrow label={eyebrow} accentClass={accentClass} />
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SectionEyebrow({ label, accentClass }: { label: string; accentClass: string }) {
  return (
    <Badge variant="outline" className={cn("px-3 py-1", accentClass)}>
      {label}
    </Badge>
  );
}

function TournamentMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm text-foreground md:text-right">
      <span className="mr-2 text-xs uppercase tracking-[0.14em] text-muted-foreground md:hidden">{label}</span>
      {value}
    </div>
  );
}

function EmptyStateCard({ title, description, actionLabel, href }: { title: string; description: string; actionLabel: string; href: string }) {
  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-xl font-semibold text-foreground">{title}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          <Link href={href} className="mt-5 inline-flex">
            <Button variant="outline" className="gap-2">
              {actionLabel}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function getTournamentLocation(district: string | null, state: string | null) {
  const value = [district, state].filter(Boolean).join(", ");
  return value || "India";
}

function getWinRate(matches: number, wins: number) {
  if (matches <= 0) return 0;
  return Math.round((wins / matches) * 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatCompactNumber(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
