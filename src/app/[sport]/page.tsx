import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SiteFooter from "@/components/layout/site-footer";
import { SportAuthOverlay } from "@/components/auth/sport-auth-overlay";
import { SportAnnouncementBar, type SportAnnouncement } from "@/components/sport-announcement-bar";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { SportType } from "@prisma/client";
import { buildLeaderboardEligibleUserWhere } from "@/lib/user-sport";
import { ArrowRight, Calendar, ChevronRight, Clock3, MapPin, Medal, PlayCircle, ShieldCheck, TimerReset, TrendingUp, Trophy, Users } from "lucide-react";

type Props = { params: Promise<{ sport: string }>; searchParams?: Promise<{ auth?: string }> };
type Visual = { src?: string; title: string; label: string };

export default async function SportHomePage({ params, searchParams }: Props) {
  const { sport } = await params;
  const resolved = searchParams ? await searchParams : undefined;
  const authView = resolved?.auth === "login" || resolved?.auth === "register" ? resolved.auth : null;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";
  const sportType = isCornhole ? SportType.CORNHOLE : SportType.DARTS;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const softAccentClass = isCornhole
    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900"
    : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900";
  const accentTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const accentBorderClass = isCornhole ? "border-green-200/70" : "border-teal-200/70";
  const gradientClass = isCornhole ? "from-green-500 to-emerald-600" : "from-teal-500 to-cyan-600";
  const heroGlowClass = isCornhole ? "from-green-500/15 via-emerald-400/8 to-transparent" : "from-teal-500/15 via-cyan-400/8 to-transparent";
  const statTintClass = isCornhole ? "from-green-500/8 to-emerald-500/12" : "from-teal-500/8 to-cyan-500/12";

  const visuals: Visual[] = isCornhole
    ? [
        { src: "/images/hero/cornhole/action-shot.png", title: "Cornhole match action", label: "Match footage slot" },
        { src: "/images/hero/cornhole/tournament-scene.png", title: "Cornhole tournament environment", label: "Tournament environment" },
      ]
    : [
        { src: "/images/hero/darts/action-shot.png", title: "Darts match action", label: "Match footage slot" },
        { src: "/images/hero/darts/tournament-scene.png", title: "Darts tournament environment", label: "Tournament environment" },
      ];

  const [tournaments, topPlayers, stats, recentMatch, activePlayers] = await Promise.all([
    db.tournament.findMany({
      where: { sport: sportType, isPublic: true, endDate: { gte: now } },
      orderBy: { startDate: "asc" },
      take: 4,
      include: { _count: { select: { registrations: true } } },
    }).catch((e) => (console.error("sport tournaments", e), [])),
    db.user.findMany({
      where: buildLeaderboardEligibleUserWhere(sportType, { requirePublic: true }),
      orderBy: { visiblePoints: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, hiddenElo: true, visiblePoints: true },
    }).catch((e) => (console.error("sport players", e), [])),
    Promise.all([
      db.tournament.count({ where: { sport: sportType } }),
      db.user.count({ where: { sport: sportType, isActive: true } }),
      db.city.count({ where: { sport: sportType } }),
      db.tournament.aggregate({ where: { sport: sportType }, _sum: { prizePool: true } }).then((r) => r._sum.prizePool ?? 0),
      db.match.count({ where: { sport: sportType, playedAt: { gte: weekAgo } } }),
    ]).then(([tournamentCount, playerCount, cityCount, prizePoolTotal, matchesThisWeek]) => ({ tournamentCount, playerCount, cityCount, prizePoolTotal, matchesThisWeek })).catch((e) => {
      console.error("sport stats", e);
      return { tournamentCount: 0, playerCount: 0, cityCount: 0, prizePoolTotal: 0, matchesThisWeek: 0 };
    }),
    db.match.findFirst({
      where: { sport: sportType },
      orderBy: { playedAt: "desc" },
      select: { playedAt: true, tournamentId: true, scoreA: true, scoreB: true },
    }).catch((e) => (console.error("recent match", e), null)),
    db.tournamentRegistration.findMany({
      where: { registeredAt: { gte: monthAgo }, tournament: { sport: sportType } },
      distinct: ["userId"],
      select: { userId: true },
    }).then((rows) => rows.length).catch((e) => (console.error("active players", e), 0)),
  ]);

  const nextTournament = tournaments[0] ?? null;
  const daysUntilStart = nextTournament ? Math.max(0, Math.ceil((nextTournament.startDate.getTime() - now.getTime()) / 86400000)) : 10;
  const daysUntilDeadline = nextTournament ? Math.max(0, Math.ceil((nextTournament.regDeadline.getTime() - now.getTime()) / 86400000)) : null;
  const seasonSignal = nextTournament ? (daysUntilStart === 0 ? "Registrations opening now" : `Season launching in ${daysUntilStart} days`) : "Registrations opening soon";
  const moduleStatus = nextTournament ? (daysUntilDeadline && daysUntilDeadline > 0 ? `Registration closes in ${daysUntilDeadline} days` : "Registration window active") : "Opening soon";
  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100);
  const formatDate = (date: Date) => new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const lastMatchText = recentMatch?.playedAt
    ? (() => {
        const hours = Math.max(1, Math.round((now.getTime() - recentMatch.playedAt.getTime()) / 3600000));
        return hours < 24 ? `Last match recorded ${hours}h ago` : `Last match recorded ${Math.ceil(hours / 24)}d ago`;
      })()
    : "Leaderboard initializing";

  const heroSignals = [
    { label: "Season", value: seasonSignal, helper: nextTournament ? `${formatDate(nextTournament.startDate)}${nextTournament.city ? ` • ${nextTournament.city}` : ""}` : "Opening soon" },
    { label: "Ranked", value: topPlayers.length > 0 ? `${topPlayers.length} players` : "Initializing", helper: "Match-based" },
    { label: "Path", value: "District ? State ? National", helper: "Progression" },
    { label: "Active", value: activePlayers > 0 ? `${activePlayers} this month` : "Early access", helper: "Player pool" },
  ];
  const activitySignals = [
    { label: "This week", value: stats.matchesThisWeek > 0 ? `${stats.matchesThisWeek} matches` : "Starting up", helper: "Official play" },
    { label: "This month", value: activePlayers > 0 ? `${activePlayers} players` : "Early access", helper: "Participation" },
    { label: "Last result", value: lastMatchText, helper: "Live signal" },
  ];
  const announcementItems: SportAnnouncement[] = [
    recentMatch?.playedAt
      ? {
          id: "live-last-match",
          type: "LIVE",
          message:
            recentMatch.scoreA !== null && recentMatch.scoreB !== null
              ? `Last official result ${recentMatch.scoreA}-${recentMatch.scoreB} • ${lastMatchText.replace("Last match recorded ", "")}`
              : lastMatchText,
          href: recentMatch.tournamentId ? `/${sport}/tournaments/${recentMatch.tournamentId}` : undefined,
        }
      : { id: "live-launch", type: "LIVE", message: "First matches launching soon" },
    nextTournament
      ? {
          id: "next-tournament",
          type: "TOURNAMENT",
          message: `${nextTournament.city || "City event"} • ${nextTournament._count.registrations}/${nextTournament.maxPlayers} slots filled`,
          href: `/${sport}/tournaments/${nextTournament.id}`,
        }
      : { id: "tournament-soon", type: "TOURNAMENT", message: "Registrations opening in your city" },
    {
      id: "tournament-slots",
      type: "TOURNAMENT",
      message: nextTournament ? "Limited slots available in the next competition window" : "Limited slots available when events go live",
      href: nextTournament ? `/${sport}/tournaments/${nextTournament.id}` : undefined,
    },
    topPlayers[0]
      ? {
          id: "ranking-active",
          type: "RANKING",
          message: `${topPlayers[0].firstName} leads the current board • Rankings update after every match`,
          href: `/${sport}/leaderboard`,
        }
      : { id: "ranking-first", type: "RANKING", message: "Be among the first ranked players" },
    {
      id: "live-players",
      type: "LIVE",
      message: activePlayers > 0 ? `${activePlayers} players active this month` : "Early players joining ValorHive",
    },
    {
      id: "ranking-mechanism",
      type: "RANKING",
      message: "Top players qualify for the next competition level",
      href: `/${sport}/leaderboard`,
    },
  ];
  const steps = [
    { step: "01", title: "Create profile", description: "Enter the system." },
    { step: "02", title: "Join tournaments", description: "Pick a live event." },
    { step: "03", title: "Play matches", description: "Results get recorded." },
    { step: "04", title: "Climb rankings", description: "Move up with each match." },
  ];
  const triggers = [
    { icon: Users, title: "Limited slots", description: "Finite entries." },
    { icon: Clock3, title: "Deadlines", description: "Visible closing dates." },
    { icon: Trophy, title: "Recorded results", description: "Official outcomes." },
    { icon: TimerReset, title: "Season play", description: "Recurring cycles." },
  ];

  return (
    <>
      <SportAuthOverlay sport={sport} initialView={authView} />
      <section className="relative overflow-hidden px-4 pb-10 pt-8 sm:pb-14 sm:pt-10">
        <div className={cn("absolute inset-x-0 top-0 h-80 bg-gradient-to-b", heroGlowClass)} />
        <div className="container relative mx-auto">
          <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:gap-10">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge variant="outline" className={cn("gap-2 border-current/30 px-3 py-1", softAccentClass)}><Trophy className="h-3.5 w-3.5" />{sportName} Competition Hub</Badge>
                <div className="space-y-3">
                  <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">Structured {sportName.toLowerCase()} competition. Live rankings.</h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Defined formats, recorded results, visible progression.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/${sport}?auth=register`}><Button size="lg" className={cn("gap-2 text-white shadow-sm", primaryBtnClass)}>Start your player profile<ArrowRight className="h-4 w-4" /></Button></Link>
                <Link href={`/${sport}/tournaments`}><Button size="lg" variant="outline" className="gap-2">Join your first tournament<Calendar className="h-4 w-4" /></Button></Link>
                <Link href={`/${sport}/leaderboard`}><Button size="lg" variant="ghost" className="gap-2">View rankings<ChevronRight className="h-4 w-4" /></Button></Link>
              </div>
              <SportAnnouncementBar items={announcementItems} />
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5">Rankings update after every match</span>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5">Structured tournaments</span>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5">District to national</span>
              </div>
              <div className={cn("grid gap-4 rounded-2xl border bg-gradient-to-r p-5 md:grid-cols-2 xl:grid-cols-4", accentBorderClass, statTintClass)}>{heroSignals.map((item) => <InfoTile key={item.label} accentClass={accentTextClass} {...item} />)}</div>
            </div>
            <Card className="overflow-hidden border-border/70 bg-card/95 backdrop-blur-sm">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-border/60 lg:border-b-0 lg:border-r"><MediaPane visual={visuals[0]} fallback={visuals[1]} gradientClass={gradientClass} /></div>
                <CardContent className="space-y-5 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Competition Module</p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">{nextTournament ? nextTournament.name : `${sportName} season opening soon`}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{nextTournament ? "Next event, slots, fee, and status." : "Next event details will appear here."}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniMetric label="Next event" value={nextTournament ? formatDate(nextTournament.startDate) : `Launching in ${daysUntilStart} days`} helper={nextTournament?.city || "City announcement soon"} />
                    <MiniMetric label="Slots filled" value={nextTournament ? `${nextTournament._count.registrations}/${nextTournament.maxPlayers}` : "Opening soon"} helper={nextTournament ? "Limited slots per tournament" : "Early registrations will open here"} />
                    <MiniMetric label="Entry fee" value={nextTournament ? nextTournament.entryFee > 0 ? formatCurrency(nextTournament.entryFee) : "Free entry" : "TBA"} helper="Visible before registration" />
                    <MiniMetric label="Status" value={moduleStatus} helper={nextTournament ? "Defined format and deadline" : "Be among the first players"} />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/25 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Activity signals</p>
                    <div className="mt-3 space-y-3">{activitySignals.map((item) => <MiniMetric key={item.label} {...item} />)}</div>
                  </div>
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:py-16">
        <div className="container mx-auto space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>Competition Structure</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">How competition works</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Simple, repeatable, ranked.</p>
            </div>
            <Link href={`/${sport}?auth=register`}><Button variant="outline" className="gap-2">Start your player profile<ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/70 bg-card"><CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">{steps.map((item) => <div key={item.step} className="rounded-2xl border border-border/60 bg-muted/25 p-5"><div className={cn("mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold", softAccentClass)}>Step {item.step}</div><h3 className="text-base font-semibold text-foreground">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div>)}</CardContent></Card>
            <div className="grid gap-5">
              <Card className="border-border/70 bg-card"><CardHeader className="pb-3"><CardTitle className="text-xl">Progression pathway</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-3">{["District", "State", "National"].map((level, i) => <div key={level} className="flex items-center gap-3"><div className={cn("rounded-full border px-4 py-2 text-sm font-semibold", softAccentClass)}>{level}</div>{i < 2 ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : null}</div>)}</div><p className="text-sm leading-6 text-muted-foreground">Play. Record. Progress.</p></CardContent></Card>
              <Card className="border-border/70 bg-card"><CardHeader className="pb-3"><CardTitle className="text-xl">Competitive triggers</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{triggers.map((item) => <ReasonRow key={item.title} accentClass={softAccentClass} {...item} />)}</CardContent></Card>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/30 px-4 py-12 sm:py-16">
        <div className="container mx-auto space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>Upcoming Tournaments</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Upcoming tournaments</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Date, location, fee, slots.</p>
            </div>
            <Link href={`/${sport}/tournaments`}><Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">View all tournaments<ChevronRight className="h-4 w-4" /></Button></Link>
          </div>
          {tournaments.length === 0 ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Card className="border-border/70 bg-card"><CardContent className="space-y-4 p-6"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Upcoming tournaments loading</p><Badge variant="outline" className={cn("px-2.5 py-1", softAccentClass)}>Registrations opening soon</Badge></div><Skeleton className="h-52 w-full rounded-2xl" /><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></CardContent></Card>
              <Card className="border-border/70 bg-card"><CardContent className="flex h-full flex-col justify-center p-8"><Badge variant="outline" className={cn("mb-4 w-fit px-3 py-1", softAccentClass)}>Be early</Badge><h3 className="text-2xl font-semibold text-foreground">New tournaments launching soon.</h3><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Register early for the first ranking cycle.</p><div className="mt-6 flex flex-wrap gap-3"><Link href={`/${sport}?auth=register`}><Button className={cn("text-white", primaryBtnClass)}>Register early access</Button></Link><Link href={`/${sport}/tournaments`}><Button variant="outline">Check tournament board</Button></Link></div></CardContent></Card>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{tournaments.slice(0, 3).map((tournament, index) => <Link key={tournament.id} href={`/${sport}/tournaments/${tournament.id}`} className="group h-full"><Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"><div className="relative h-52 overflow-hidden"><MediaImage src={visuals[index % visuals.length]?.src} alt={tournament.name} gradientClass={gradientClass} /><div className="absolute inset-x-3 top-3 flex items-center justify-between gap-3"><Badge className="shadow-sm" variant="secondary">{tournament.scope || "Open play"}</Badge><Badge variant="outline" className="border-white/30 bg-black/35 text-white backdrop-blur-sm">{tournament._count.registrations}/{tournament.maxPlayers} filled</Badge></div></div><CardContent className="flex flex-1 flex-col gap-4 p-5"><div className="space-y-2"><h3 className="line-clamp-2 text-lg font-semibold text-foreground">{tournament.name}</h3><div className="space-y-1.5 text-sm text-muted-foreground"><div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /><span>{formatDate(tournament.startDate)}</span></div><div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span className="line-clamp-1">{tournament.city || tournament.district || tournament.state || "Venue to be announced"}</span></div></div></div><div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Entry fee</span><span className={cn("font-semibold", accentTextClass)}>{tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : "Free entry"}</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Registration</span><span className="font-semibold text-foreground">{Math.max(0, Math.ceil((tournament.regDeadline.getTime() - now.getTime()) / 86400000))} days left</span></div><div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Competition signal</span><span className="font-semibold text-foreground">Limited slots</span></div></div><Button variant="outline" className="mt-auto gap-2">Join your first tournament<ArrowRight className="h-4 w-4" /></Button></CardContent></Card></Link>)}</div>
          )}
        </div>
      </section>

      <section className="px-4 py-12 sm:py-16">
        <div className="container mx-auto">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/70 bg-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4"><div><Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>Leaderboard</Badge><CardTitle className="text-2xl">Ranking progression</CardTitle><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Top players move first.</p></div><Link href={`/${sport}/leaderboard`}><Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">View rankings<ChevronRight className="h-4 w-4" /></Button></Link></CardHeader>
              <CardContent className="p-0">{topPlayers.length === 0 ? <div className="space-y-4 p-6"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Leaderboard initializing</p><Badge variant="outline" className={cn("px-2.5 py-1", softAccentClass)}>First ranked players</Badge></div><div className="grid gap-3">{[1, 2, 3].map((i) => <div key={i} className="flex items-center gap-4 rounded-2xl border border-border/60 p-4"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div><Skeleton className="h-4 w-16" /></div>)}</div><div className="rounded-2xl border border-border/60 bg-muted/25 p-4"><p className="font-medium text-foreground">Leaderboard starts once official matches are played.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Be one of the first ranked players and put yourself in position for the next competition level.</p><div className="mt-4"><Link href={`/${sport}?auth=register`}><Button size="sm" className={cn("text-white", primaryBtnClass)}>Start your player profile</Button></Link></div></div></div> : <div className="divide-y divide-border/60">{topPlayers.map((player, index) => <Link key={player.id} href={`/${sport}/players/${player.id}`} className="flex items-center gap-4 p-5 transition-colors hover:bg-muted/40"><div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold", index === 0 ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" : index === 1 ? "bg-slate-500/15 text-slate-700 dark:text-slate-300" : index === 2 ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" : "bg-muted text-muted-foreground")}>{index + 1}</div><div className="flex-1"><p className="font-medium text-foreground">{player.firstName} {player.lastName}</p><p className="text-sm text-muted-foreground">Elo {Math.round(player.hiddenElo)}</p></div><div className="text-right"><p className={cn("font-semibold", accentTextClass)}>{player.visiblePoints} pts</p><p className="text-xs text-muted-foreground">Visible ranking points</p></div></Link>)}</div>}</CardContent>
            </Card>
            <div className="grid gap-5">
              <Card className="border-border/70 bg-card"><CardHeader className="pb-3"><CardTitle className="text-xl">Why players return</CardTitle></CardHeader><CardContent className="grid gap-3"><ReasonRow icon={ShieldCheck} title="Verified results" description="Official outcomes." accentClass={softAccentClass} /><ReasonRow icon={TrendingUp} title="Visible progress" description="Ranks keep moving." accentClass={softAccentClass} /><ReasonRow icon={Medal} title="Higher levels" description="Play toward bigger stages." accentClass={softAccentClass} /></CardContent></Card>
              <Card className="overflow-hidden border-border/70 bg-card"><div className="grid gap-0 md:grid-cols-[1fr_1fr]"><div className="border-b border-border/60 md:border-b-0 md:border-r"><MediaPane visual={visuals[1]} fallback={visuals[0]} gradientClass={gradientClass} compact /></div><CardContent className="flex flex-col justify-between p-6"><div><Badge variant="outline" className={cn("mb-3 px-3 py-1", softAccentClass)}>Early advantage</Badge><h3 className="text-2xl font-semibold text-foreground">Be among the first ranked players.</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Start early. Move first.</p></div><div className="mt-6 flex flex-wrap gap-3"><Link href={`/${sport}?auth=register`}><Button className={cn("text-white", primaryBtnClass)}>Register early access</Button></Link><Link href={`/${sport}/leaderboard`}><Button variant="outline">View rankings</Button></Link></div></CardContent></div></Card>
            </div>
          </div>
        </div>
      </section>

      <section className={cn("px-4 py-12", isCornhole ? "bg-green-600" : "bg-teal-600")}><div className="container mx-auto text-center"><h2 className="text-3xl font-bold text-white">Start competing in {sportName.toLowerCase()}.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">Create profile. Join tournament. Get ranked.</p><div className="mt-6 flex flex-wrap items-center justify-center gap-3"><Link href={`/${sport}?auth=register`}><Button size="lg" className="bg-white text-slate-950 hover:bg-slate-100">Start your player profile</Button></Link><Link href={`/${sport}/tournaments`}><Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">Join your first tournament</Button></Link></div></div></section>
      <SiteFooter />
    </>
  );
}

function InfoTile({ label, value, helper, accentClass }: { label: string; value: string; helper: string; accentClass: string }) {
  return <div className="rounded-xl border border-border/50 bg-background/85 p-4 text-left backdrop-blur-sm"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-2 text-lg font-bold leading-6", accentClass)}>{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p></div>;
}

function MiniMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-xl border border-border/60 bg-muted/25 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold text-foreground">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p></div>;
}

function ReasonRow({ icon: Icon, title, description, accentClass }: { icon: typeof Trophy; title: string; description: string; accentClass: string }) {
  return <div className="flex gap-4 rounded-2xl border border-border/60 bg-muted/25 p-4"><div className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", accentClass)}><Icon className="h-4 w-4" /></div><div><p className="font-medium text-foreground">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div></div>;
}

function MediaPane({ visual, fallback, gradientClass, compact = false }: { visual: Visual; fallback: Visual; gradientClass: string; compact?: boolean }) {
  return <div className={cn("relative overflow-hidden", compact ? "min-h-[250px]" : "min-h-[360px]")}><MediaImage src={visual.src} alt={visual.title} gradientClass={gradientClass} /><div className="absolute inset-0 flex flex-col justify-end p-5"><div className="max-w-sm rounded-2xl border border-white/15 bg-black/45 p-4 text-white backdrop-blur-md"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"><PlayCircle className="h-4 w-4" />{visual.label}</div><p className="text-base font-semibold">{visual.title}</p><p className="mt-2 text-sm leading-6 text-white/80">Media slot for real match action.</p></div></div>{!visual.src ? <div className="absolute inset-0 flex items-center justify-center p-8"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm"><p className="text-sm font-medium text-white">Match footage slot</p><p className="mt-2 text-sm text-white/75">{fallback.title}</p></div></div> : null}</div>;
}

function MediaImage({ src, alt, gradientClass }: { src?: string; alt: string; gradientClass: string }) {
  if (!src) return <div className="relative h-full w-full overflow-hidden bg-muted/40"><div className={cn("absolute inset-0 bg-gradient-to-br opacity-35", gradientClass)} /><div className="absolute inset-0 p-6"><Skeleton className="h-full w-full rounded-2xl" /></div></div>;
  return <><img src={src} alt={alt} className="h-full w-full object-cover" /><div className={cn("absolute inset-0 bg-gradient-to-t opacity-35", gradientClass)} /></>;
}

