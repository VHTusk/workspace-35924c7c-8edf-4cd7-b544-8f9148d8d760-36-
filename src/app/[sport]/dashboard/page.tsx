"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Heart,
  Loader2,
  Lock,
  Medal,
  Play,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import FollowersModal from "@/components/follow/followers-modal";
import { ActivityFeedCard } from "@/components/activity/activity-feed-card";
import { cn } from "@/lib/utils";
import { useSportStyling } from "@/hooks/use-sport-styling";
import { useFollowCountRefresh } from "@/hooks/use-follow-count";

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  photoUrl: string | null;
  score: number;
  elo: number;
  rank: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  wins: number;
  losses: number;
  matches: number;
  currentStreak: number;
  bestStreak: number;
  followersCount: number;
  followingCount: number;
}

interface PlayerStatsData {
  visiblePoints: number;
  hiddenElo: number;
  highestElo: number;
  rank: number;
  totalPlayers: number;
  tier: string;
  tierProgress: number;
  nextTier: string;
  pointsToNextTier: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  podiumFinishes: number;
  averagePointsPerMatch: number;
  recentMatches: Array<{
    id: string;
    tournamentName: string;
    opponent: string;
    result: "WIN" | "LOSS";
    score: string;
    pointsEarned: number;
    eloChange: number;
    date: string;
  }>;
  performanceHistory: Array<{
    month: string;
    elo: number;
    points: number;
    matches: number;
  }>;
  winLossByMonth: Array<{
    month: string;
    wins: number;
    losses: number;
  }>;
}

interface PlayerTournament {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  city: string | null;
  state: string | null;
  scope: string;
  registrationStatus: string;
  matchesPlayed: number;
  matchesWon: number;
  finalRank: number | null;
}

interface PlayerTournamentsResponse {
  upcoming: PlayerTournament[];
  active: PlayerTournament[];
  completed: PlayerTournament[];
  total: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLocation(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join(", ") || "Location will be announced";
}

function MilestoneStatCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  locked = false,
  lockedText,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  locked?: boolean;
  lockedText?: string;
}) {
  return (
    <Card className={cn("border-border/50 shadow-sm transition-all", locked && "opacity-75")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("rounded-xl p-2.5", bgClass)}>
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
          {locked ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          ) : null}
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          {locked ? (
            <p className="text-sm font-medium text-foreground">{lockedText}</p>
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LockedModuleState({
  icon: Icon,
  title,
  description,
  unlockLabel,
  actionLabel,
  actionHref,
  primaryBtnClass,
  skeleton = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  unlockLabel: string;
  actionLabel: string;
  actionHref: string;
  primaryBtnClass: string;
  skeleton?: boolean;
}) {
  return (
    <div className="space-y-4">
      {skeleton ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="mt-3 h-28 rounded-lg bg-muted/80" />
          </div>
          <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-12 rounded-lg bg-muted/80" />
            <div className="h-12 rounded-lg bg-muted/80" />
            <div className="h-12 rounded-lg bg-muted/80" />
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Unlock condition: {unlockLabel}
        </p>
        <Link href={actionHref}>
          <Button className={cn("mt-4 text-white", primaryBtnClass)}>
            {actionLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  color,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  color: string;
  bgColor: string;
}) {
  return (
    <Link href={href}>
      <Button
        variant="outline"
        className="h-auto w-full flex-col gap-2 border-2 px-5 py-4 transition-all hover:border-current hover:shadow-md"
      >
        <div className={cn("rounded-lg p-2", bgColor)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </Button>
    </Link>
  );
}

function WinLossChart({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const data = [
    { name: "Wins", value: wins, color: "#22c55e" },
    { name: "Losses", value: losses, color: "#ef4444" },
  ];
  const winPercent = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={60} dataKey="value" paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{winPercent}%</span>
          <span className="text-xs text-muted-foreground">Win Rate</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { sport, isCornhole, classes, theme } = useSportStyling();
  const [user, setUser] = useState<UserData | null>(null);
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [tournaments, setTournaments] = useState<PlayerTournamentsResponse>({
    upcoming: [],
    active: [],
    completed: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const followRefreshKey = useFollowCountRefresh();

  const primaryTextClass = classes.primaryText;
  const primaryBtnClass = classes.primaryBtn;

  const fetchDashboardData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const userResponse = await fetch(`/api/player/me?sport=${sport}`, {
        signal,
        cache: "no-store",
      });

      if (signal.aborted) return;

      if (userResponse.status === 403) {
        router.push(`/${sport}/login?error=sport_mismatch`);
        return;
      }

      if (userResponse.status === 401) {
        router.push(`/${sport}/login`);
        return;
      }

      if (!userResponse.ok) {
        throw new Error("Failed to fetch player data");
      }

      const userData = await userResponse.json();
      if (signal.aborted) return;
      setUser(userData);

      const [statsResponse, tournamentsResponse] = await Promise.all([
        fetch("/api/player/stats", { signal, cache: "no-store" }),
        fetch("/api/player/tournaments", { signal, cache: "no-store" }),
      ]);

      if (!signal.aborted && statsResponse.ok) {
        setStats(await statsResponse.json());
      }

      if (!signal.aborted && tournamentsResponse.ok) {
        setTournaments(await tournamentsResponse.json());
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [router, sport]);

  useEffect(() => {
    setLoading(true);
    fetchDashboardData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDashboardData, followRefreshKey]);

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn("h-10 w-10 animate-spin", classes.primaryText)} />
          <span className="text-sm text-muted-foreground">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`
    : "P";

  const wins = stats?.matchesWon ?? user?.wins ?? 0;
  const losses = stats?.matchesLost ?? user?.losses ?? 0;
  const settledMatches = wins + losses;
  const matchesPlayed = stats?.matchesPlayed ?? settledMatches;
  const winRatePercent = stats?.winRate ?? (matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0);
  const tournamentsWon = stats?.tournamentsWon ?? user?.tournamentsWon ?? 0;
  const currentStreak = stats?.currentStreak ?? user?.currentStreak ?? 0;
  const bestStreak = stats?.bestStreak ?? user?.bestStreak ?? 0;
  const points = stats?.visiblePoints ?? user?.score ?? 0;
  const elo = stats?.hiddenElo ?? user?.elo ?? 1000;
  const totalPlayers = stats?.totalPlayers ?? 0;
  const validRank = matchesPlayed >= 1 && Boolean(stats?.rank && stats.rank > 0 && totalPlayers > 0);
  const rank = validRank ? stats?.rank ?? null : null;
  const isNewUser = matchesPlayed <= 1;
  const performanceUnlocked = matchesPlayed >= 3;
  const recentResultsUnlocked = matchesPlayed >= 1;
  const recentActivityUnlocked = matchesPlayed >= 1;
  const advancedUnlocked = matchesPlayed >= 5;
  const rankProgressUnlocked = Boolean(validRank && matchesPlayed >= 3);
  const joinedTournaments = tournaments.total;
  const tournamentModulesUnlocked = joinedTournaments >= 1;
  const hasPendingResults = matchesPlayed > settledMatches;
  const topTenProgress =
    rankProgressUnlocked && rank
      ? totalPlayers <= 10
        ? 100
        : Math.max(0, Math.min(100, ((totalPlayers - rank) / Math.max(totalPlayers - 10, 1)) * 100))
      : 0;
  const nextTopTenTarget = rank && rank > 10 ? rank - 10 : 0;
  const recentMatches = stats?.recentMatches || [];
  const performanceHistory = stats?.performanceHistory || [];
  const winLossByMonth = stats?.winLossByMonth || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {!validRank ? (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardContent className="p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Unranked Player
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">
                You are currently unranked. Play matches to enter leaderboard.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your official rank appears after your first completed match in {isCornhole ? "Cornhole" : "Darts"}.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-transparent to-muted/30 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className={cn("absolute -inset-1 rounded-full opacity-75 blur-md", classes.primaryBgSubtle)} />
              <Avatar
                className={cn(
                  "relative h-20 w-20 border-4 border-background ring-4 ring-background md:h-24 md:w-24",
                  classes.glowPrimary,
                )}
              >
                <AvatarImage src={user?.photoUrl || undefined} />
                <AvatarFallback className={cn("text-2xl font-bold md:text-3xl", classes.primaryBgSubtle, classes.primaryText)}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isCornhole ? "Cornhole" : "Darts"} Player Dashboard
                </span>
                {tournamentsWon > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <Crown className="h-3 w-3" />
                    Champion
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">
                Structured Competition Dashboard
              </h1>
              <p className="mt-1 text-muted-foreground">
                Your dashboard unlocks deeper insights as you progress through structured competition.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/${sport}/tournaments`}>
              <Button
                size="lg"
                className={cn(
                  "h-12 rounded-xl px-6 font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl",
                  primaryBtnClass,
                )}
              >
                <Search className="mr-2 h-4 w-4" />
                {isNewUser ? "Join Your First Tournament" : "Find Tournament"}
              </Button>
            </Link>
            <Link href={`/${sport}/players`}>
              <Button size="lg" variant="outline" className="h-12 rounded-xl border-2 px-6 font-medium">
                <Users className="mr-2 h-4 w-4" />
                Find Players
              </Button>
            </Link>
            <Link href={`/${sport}/dashboard/cities`}>
              <Button size="lg" variant="outline" className="h-12 rounded-xl border-2 px-6 font-medium">
                <Zap className="mr-2 h-4 w-4" />
                Play Duel
              </Button>
            </Link>
          </div>
        </div>

        <div className={cn("mt-6 grid grid-cols-2 gap-4 border-t pt-6 md:grid-cols-4", classes.primaryBorderLight)}>
          <button
            onClick={() => setShowFollowersModal(true)}
            className="group rounded-xl p-3 text-left transition-colors hover:bg-muted/50"
            aria-label="View followers"
          >
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2", classes.primaryBgSubtle)}>
                <Heart className={cn("h-4 w-4", classes.primaryText)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{user?.followersCount || 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setShowFollowersModal(true)}
            className="group rounded-xl p-3 text-left transition-colors hover:bg-muted/50"
            aria-label="View following"
          >
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2", classes.primaryBgSubtle)}>
                <UserCheck className={cn("h-4 w-4", classes.primaryText)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{user?.followingCount || 0}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
            </div>
          </button>
          <div className="rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2", classes.primaryBgSubtle)}>
                <Sparkles className={cn("h-4 w-4", classes.primaryText)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{points}</p>
                <p className="text-xs text-muted-foreground">Total Points</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2", classes.primaryBgSubtle)}>
                <Medal className={cn("h-4 w-4", classes.primaryText)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{validRank && rank ? `#${rank}` : "Unranked"}</p>
                <p className="text-xs text-muted-foreground">
                  {validRank ? "Current Rank" : "Play your first match"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MilestoneStatCard
          title="Tournaments Won"
          value={tournamentsWon}
          icon={Trophy}
          colorClass="text-amber-500"
          bgClass="bg-amber-500/10"
        />
        <MilestoneStatCard
          title="Total Matches"
          value={matchesPlayed}
          icon={Target}
          colorClass="text-blue-500"
          bgClass="bg-blue-500/10"
        />
        <MilestoneStatCard
          title="Current Streak"
          value={currentStreak}
          icon={Flame}
          colorClass="text-orange-500"
          bgClass="bg-orange-500/10"
          locked={!performanceUnlocked}
          lockedText="Unlocks after 3 matches"
        />
        <MilestoneStatCard
          title="Best Streak"
          value={bestStreak}
          icon={Zap}
          colorClass="text-purple-500"
          bgClass="bg-purple-500/10"
          locked={!performanceUnlocked}
          lockedText="Unlocks after 3 matches"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/50 shadow-sm lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Activity className={cn("h-5 w-5", classes.primaryText)} />
                Performance Overview
              </CardTitle>
              <Link href={`/${sport}/stats`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View Details
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!performanceUnlocked ? (
              <LockedModuleState
                icon={Activity}
                title="Performance insights unlock after 3 matches"
                description="Win rate, chart trends, and streak analysis become meaningful once you have a few recorded results."
                unlockLabel="Play 3 completed matches"
                actionLabel="Complete 3 Matches to Unlock Insights"
                actionHref={`/${sport}/tournaments`}
                primaryBtnClass={primaryBtnClass}
                skeleton
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-muted/30 p-4">
                    <WinLossChart wins={wins} losses={losses} />
                    <div className="mt-4 flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <span className="text-sm text-muted-foreground">
                          Wins <span className="font-semibold text-foreground">{wins}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <span className="text-sm text-muted-foreground">
                          Losses <span className="font-semibold text-foreground">{losses}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Win Rate</span>
                      <span className="text-2xl font-bold text-foreground">{Math.round(winRatePercent)}%</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, Math.round(winRatePercent)))} className="h-3" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Based on {matchesPlayed} completed matches.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Performance Trend</span>
                      <span className="text-xs text-muted-foreground">Last 6 months</span>
                    </div>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={performanceHistory}>
                          <defs>
                            <linearGradient id="dashboard-points" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={theme.primaryColor} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={theme.primaryColor} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid hsl(var(--border))",
                              background: "hsl(var(--background))",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="points"
                            stroke={theme.primaryColor}
                            strokeWidth={2.5}
                            fill="url(#dashboard-points)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">Current Streak</span>
                      </div>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{currentStreak}</p>
                    </div>
                    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-xs text-muted-foreground">Best Streak</span>
                      </div>
                      <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{bestStreak}</p>
                    </div>
                  </div>

                  {hasPendingResults ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">
                      Match result pending. Some recent matches are still awaiting final result confirmation.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <BarChart3 className={cn("h-5 w-5", classes.primaryText)} />
              Your Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!validRank ? (
              <LockedModuleState
                icon={Medal}
                title="You are not ranked yet"
                description="Play your first completed match to enter the leaderboard and unlock rank tracking."
                unlockLabel="At least 1 completed match"
                actionLabel="View Available Tournaments"
                actionHref={`/${sport}/tournaments`}
                primaryBtnClass={primaryBtnClass}
              />
            ) : (
              <>
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 p-6 text-center">
                  <p className="mb-2 text-sm text-muted-foreground">Current Rank</p>
                  <p className={cn("text-5xl font-bold", classes.primaryText)}>#{rank}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="text-xl font-semibold text-foreground">{points}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">ELO</p>
                      <p className="text-xl font-semibold text-foreground">{elo}</p>
                    </div>
                  </div>
                </div>

                {rankProgressUnlocked ? (
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Top 10 Tracking</span>
                      <span className="text-xs text-muted-foreground">
                        {rank && rank <= 10 ? "Inside top 10" : `${nextTopTenTarget} places to go`}
                      </span>
                    </div>
                    <Progress value={topTenProgress} className="h-2.5" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Progress tracking unlocks once you are ranked and have enough matches to compare performance trends.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Progress tracking unlocks once you are ranked</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Complete at least 3 matches to unlock top-10 tracking and deeper rank context.
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Current Tier</p>
                      <p className="text-lg font-semibold text-foreground">{stats?.tier || "Bronze"}</p>
                    </div>
                    <div className={cn("rounded-lg p-3", classes.primaryBgSubtle)}>
                      <TrendingUp className={cn("h-6 w-6", classes.primaryText)} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress value={stats?.tierProgress || 0} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {stats?.pointsToNextTier
                        ? `${stats.pointsToNextTier} ELO to ${stats.nextTier}`
                        : "You are at the highest available tier right now."}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Calendar className={cn("h-5 w-5", classes.primaryText)} />
                Upcoming Matches
              </CardTitle>
              <Link href={`/${sport}/tournaments?tab=my-tournaments`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!tournamentModulesUnlocked ? (
              <LockedModuleState
                icon={Calendar}
                title="Join a tournament to see your upcoming matches"
                description="Your schedule, pairings, and match timings appear here once you register for an event."
                unlockLabel="At least 1 joined tournament"
                actionLabel="View Available Tournaments"
                actionHref={`/${sport}/tournaments`}
                primaryBtnClass={primaryBtnClass}
              />
            ) : tournaments.upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 text-center">
                <p className="font-medium text-foreground">No upcoming matches scheduled yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You have joined tournaments. Your upcoming rounds will appear here once the schedule is published.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tournaments.upcoming.slice(0, 3).map((tournament) => (
                  <div key={tournament.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{tournament.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatLocation(tournament.city, tournament.state)}
                        </p>
                      </div>
                      <Badge variant="outline">{tournament.scope}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Starts {formatDate(tournament.startDate)}</span>
                      <span>Status: {tournament.registrationStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Play className={cn("h-5 w-5", classes.primaryText)} />
                Recent Results
              </CardTitle>
              <Link href={`/${sport}/stats`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!recentResultsUnlocked ? (
              <LockedModuleState
                icon={Trophy}
                title="Your match results will appear here after your first completed match"
                description="This section keeps a running history of verified results, scores, and points earned."
                unlockLabel="At least 1 completed match"
                actionLabel="Complete Your First Match"
                actionHref={`/${sport}/tournaments`}
                primaryBtnClass={primaryBtnClass}
              />
            ) : recentMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 text-center">
                <p className="font-medium text-foreground">Results will appear soon</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your completed matches are being verified and will appear here once results are finalized.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.slice(0, 4).map((match) => (
                  <div key={match.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{match.tournamentName}</p>
                        <p className="text-sm text-muted-foreground">vs {match.opponent}</p>
                      </div>
                      <Badge
                        className={cn(
                          "border-0",
                          match.result === "WIN"
                            ? "bg-green-500/15 text-green-700 dark:text-green-300"
                            : "bg-red-500/15 text-red-700 dark:text-red-300",
                        )}
                      >
                        {match.result}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Score {match.score}</span>
                      <span>{match.pointsEarned >= 0 ? `+${match.pointsEarned}` : match.pointsEarned} pts</span>
                      <span>{formatDate(match.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Trophy className={cn("h-5 w-5", classes.primaryText)} />
              Active Tournaments
            </CardTitle>
            <Link href={`/${sport}/tournaments?tab=my-tournaments`}>
              <Button variant="outline" size="sm">
                Manage Tournaments
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!tournamentModulesUnlocked ? (
              <LockedModuleState
                icon={Trophy}
                title="You are not participating in any tournaments yet"
                description="Track live event status, wins, and progression here once you join a tournament."
                unlockLabel="At least 1 joined tournament"
                actionLabel="Explore Ongoing Tournaments"
                actionHref={`/${sport}/tournaments`}
                primaryBtnClass={primaryBtnClass}
              />
          ) : tournaments.active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 text-center">
              <p className="font-medium text-foreground">No active tournaments right now</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your currently running tournaments will appear here once play begins.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tournaments.active.map((tournament) => (
                <div key={tournament.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{tournament.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatLocation(tournament.city, tournament.state)}
                      </p>
                    </div>
                    <Badge className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      Live
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Matches Played</p>
                      <p className="font-semibold text-foreground">{tournament.matchesPlayed}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/80 p-3">
                      <p className="text-xs text-muted-foreground">Matches Won</p>
                      <p className="font-semibold text-foreground">{tournament.matchesWon}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <QuickAction
              icon={BarChart3}
              label="My Stats"
              href={`/${sport}/stats`}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <QuickAction
              icon={Users}
              label="Find Players"
              href={`/${sport}/players`}
              color="text-purple-500"
              bgColor="bg-purple-500/10"
            />
            <QuickAction
              icon={Zap}
              label="Play Duel"
              href={`/${sport}/dashboard/cities`}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
          </div>
        </CardContent>
      </Card>

      {!recentActivityUnlocked ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className={cn("h-5 w-5", primaryTextClass)} />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LockedModuleState
              icon={Activity}
              title="Your activity will appear here once you start playing"
              description="Match wins, tournament joins, and progress events will be tracked here as your season begins."
              unlockLabel="At least 1 completed match"
              actionLabel="Complete Your First Match"
              actionHref={`/${sport}/tournaments`}
              primaryBtnClass={primaryBtnClass}
            />
          </CardContent>
        </Card>
      ) : (
        <ActivityFeedCard sport={sport} limit={5} />
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <TrendingUp className={cn("h-5 w-5", classes.primaryText)} />
            Advanced Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!advancedUnlocked ? (
            <LockedModuleState
              icon={TrendingUp}
              title="Advanced insights unlock after 5 matches"
              description="Deeper performance breakdowns, efficiency metrics, and consistency indicators unlock as your sample size grows."
              unlockLabel="Play 5 completed matches"
              actionLabel="Reach 5 Matches to Unlock Advanced Insights"
              actionHref={`/${sport}/tournaments`}
              primaryBtnClass={primaryBtnClass}
              skeleton
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Highest ELO</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats?.highestElo || elo}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Average Points / Match</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats?.averagePointsPerMatch || 0}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Podium Finishes</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats?.podiumFinishes || 0}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 md:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Monthly Match Volume</p>
                  <span className="text-xs text-muted-foreground">Verified activity only</span>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={winLossByMonth}>
                      <defs>
                        <linearGradient id="dashboard-wins" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                      />
                      <Area type="monotone" dataKey="wins" stroke="#22c55e" fill="url(#dashboard-wins)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {user ? (
        <FollowersModal
          open={showFollowersModal}
          onOpenChange={setShowFollowersModal}
          userId={user.id}
          sport={sport}
          isCornhole={isCornhole}
        />
      ) : null}
    </div>
  );
}
