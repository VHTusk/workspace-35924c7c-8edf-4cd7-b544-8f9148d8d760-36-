"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import {
  Trophy,
  Calendar,
  Medal,
  Target,
  Flame,
  Zap,
  Heart,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Search,
  BarChart3,
  Play,
  CheckCircle2,
  XCircle,
  Users,
  Crown,
  Activity,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef } from "react";
import FollowersModal from "@/components/follow/followers-modal";
import { ActivityFeedCard } from "@/components/activity/activity-feed-card";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
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
  tournaments: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  wins: number;
  losses: number;
  matches: number;
  winRate: string;
  currentStreak: number;
  bestStreak: number;
  followersCount: number;
  followingCount: number;
}

// Mini sparkline component for stat cards
function MiniSparkline({ data, color, isPositive }: { data: number[]; color: string; isPositive: boolean }) {
  const chartData = data.map((value, index) => ({ index, value }));
  
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Win/Loss Donut Chart
function WinLossChart({ wins, losses, primaryColor }: { wins: number; losses: number; primaryColor: string }) {
  const total = wins + losses;
  const winPercent = total > 0 ? Math.round((wins / total) * 100) : 0;
  
  const data = [
    { name: "Wins", value: wins, color: "#22c55e" },
    { name: "Losses", value: losses, color: "#ef4444" },
  ];
  
  const chartConfig = {
    wins: { label: "Wins", color: "#22c55e" },
    losses: { label: "Losses", color: "#ef4444" },
  } satisfies ChartConfig;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40">
        <div className="w-28 h-28 rounded-full border-8 border-dashed border-muted-foreground/20 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">No data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
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

// Recent form badges (W/L sequence)
function RecentForm({ wins, losses }: { wins: number; losses: number }) {
  // Generate simulated recent form based on win/loss ratio
  const total = wins + losses;
  const form: ("W" | "L")[] = [];
  
  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        No matches played yet
      </div>
    );
  }
  
  // Create a realistic form based on actual win/loss ratio
  const winRate = wins / total;
  for (let i = 0; i < 5; i++) {
    form.push(Math.random() < winRate ? "W" : "L");
  }
  
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs text-muted-foreground mr-2">Recent Form:</span>
      {form.map((result, index) => (
        <div
          key={index}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-transform hover:scale-110",
            result === "W"
              ? "bg-green-500/20 text-green-600 dark:text-green-400 ring-2 ring-green-500/30"
              : "bg-red-500/20 text-red-600 dark:text-red-400 ring-2 ring-red-500/30"
          )}
        >
          {result}
        </div>
      ))}
    </div>
  );
}

// Stat card component
function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  sparklineData,
  color,
  bgColor,
  isPrimary = false,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  sparklineData?: number[];
  color: string;
  bgColor: string;
  isPrimary?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group",
        bgColor
      )}
    >
      <CardContent className={cn("p-4", isPrimary && "p-6")}>
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              "p-2.5 rounded-xl transition-transform group-hover:scale-110",
              bgColor
            )}
          >
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          {sparklineData && (
            <MiniSparkline
              data={sparklineData}
              color={trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#94a3b8"}
              isPositive={trend === "up"}
            />
          )}
        </div>
        <div className="space-y-1">
          <p className={cn("font-bold tracking-tight", isPrimary ? "text-4xl" : "text-2xl")}>
            {value}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            {trend && trendValue && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
                  trend === "up" && "bg-green-500/15 text-green-600 dark:text-green-400",
                  trend === "down" && "bg-red-500/15 text-red-600 dark:text-red-400",
                  trend === "neutral" && "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                )}
              >
                {trend === "up" && <ArrowUpRight className="w-3 h-3" />}
                {trend === "down" && <ArrowDownRight className="w-3 h-3" />}
                {trend === "neutral" && <Minus className="w-3 h-3" />}
                {trendValue}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick action button
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
        className={cn(
          "h-auto flex-col gap-2 py-4 px-5 w-full border-2 hover:shadow-md transition-all",
          "hover:border-current"
        )}
      >
        <div className={cn("p-2 rounded-lg", bgColor)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </Button>
    </Link>
  );
}

// Empty state component
function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  primaryBtnClass,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  primaryBtnClass: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-gradient-to-r from-muted to-muted/50 rounded-full blur-xl opacity-50" />
        <div className="relative p-4 rounded-full bg-muted/50">
          <Icon className="w-10 h-10 text-muted-foreground" />
        </div>
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">{description}</p>
      <Link href={actionHref}>
        <Button className={cn("text-white", primaryBtnClass)}>
          {actionLabel}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { sport, isCornhole, classes, theme } = useSportStyling();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const followRefreshKey = useFollowCountRefresh();

  // Extract class names for easier use
  const primaryTextClass = classes.primaryText;
  const primaryBgClass = classes.primaryBgSubtle;
  const primaryBtnClass = classes.primaryBtn;

  const fetchUserData = useCallback(async () => {
    // Abort any in-flight request from previous effect
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const response = await fetch(`/api/player/me?sport=${sport}`, {
        signal,
        cache: "no-store",
      });
      
      if (signal.aborted) return;
      
      if (response.status === 403) {
        // SPORT_MISMATCH - User is logged in for a different sport
        const data = await response.json();
        console.log(`[Dashboard] Sport mismatch: logged in for ${data.sessionSport}, accessing ${sport}`);
        // Redirect to login for this sport
        router.push(`/${sport}/login?error=sport_mismatch`);
        return;
      }
      
      if (response.status === 401) {
        // Not authenticated - redirect to login
        router.push(`/${sport}/login`);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (!signal.aborted) {
          setUser(data);
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error("Failed to fetch user data:", error);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [sport, router]);

  useEffect(() => {
    setLoading(true);
    fetchUserData();

    return () => {
      // Abort in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchUserData, followRefreshKey]);

  // Get colors from theme for charts
  const primaryColor = theme.primaryColor;
  const accentColor = theme.accentColor;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn("w-10 h-10 animate-spin", classes.primaryText)} />
          <span className="text-muted-foreground text-sm">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  const initials = user
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`
    : "P";

  // Calculate derived stats
  const totalMatches = user?.matches || 0;
  const winRatePercent = totalMatches > 0
    ? Math.round(((user?.wins || 0) / totalMatches) * 100)
    : 0;
  
  // Simulated trend data for sparklines
  const rankTrendData = [10, 8, 12, 9, 7, 8, 5];
  const winsTrendData = [0, 1, 1, 2, 2, 3, 5];
  const pointsTrendData = [0, 50, 100, 150, 180, 220, 280];

  // Recent rank change simulation (in a real app this would come from API)
  const rankChange = 5; // Moved up 5 positions
  const pointsToNextRank = 250;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/50 p-6 md:p-8">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-transparent to-muted/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Player Info */}
          <div className="flex items-center gap-5">
            {/* Avatar with glow */}
            <div className="relative">
              <div
                className={cn(
                  "absolute -inset-1 rounded-full opacity-75 blur-md",
                  classes.primaryBgSubtle
                )}
              />
              <div
                className={cn(
                  "absolute -inset-2 rounded-full opacity-50 blur-lg",
                  classes.primaryBgSubtle
                )}
              />
              <Avatar
                className={cn(
                  "relative h-20 w-20 md:h-24 md:w-24 border-4 border-background ring-4 ring-background",
                  classes.glowPrimary
                )}
              >
                <AvatarImage src={user?.photoUrl || undefined} />
                <AvatarFallback
                  className={cn(
                    "text-2xl md:text-3xl font-bold",
                    classes.primaryBgSubtle,
                    classes.primaryText
                  )}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-background ring-2 ring-green-500/30" />
            </div>

            {/* Welcome message */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isCornhole ? "Cornhole" : "Darts"} Player
                </span>
                {user?.tournamentsWon && user.tournamentsWon > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-medium">
                    <Crown className="w-3 h-3" />
                    Champion
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                Welcome back, <span className={classes.primaryText}>{user?.firstName || "Player"}</span>!
              </h1>
              <p className="text-muted-foreground mt-1">
                Ready to dominate the competition today?
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/${sport}/tournaments`}>
              <Button
                size="lg"
                className={cn(
                  "text-white font-semibold h-12 px-6 rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
                  classes.primaryBtn
                )}
              >
                <Search className="w-4 h-4 mr-2" />
                Find Tournament
              </Button>
            </Link>
            <Link href={`/${sport}/tournaments?tab=my-tournaments`}>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-6 rounded-xl font-medium border-2"
              >
                <Trophy className="w-4 h-4 mr-2" />
                My Tournaments
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div
          className={cn(
            "mt-6 pt-6 border-t grid grid-cols-2 md:grid-cols-4 gap-4",
            classes.primaryBorderLight
          )}
        >
          <button
            onClick={() => setShowFollowersModal(true)}
            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            aria-label="View followers"
          >
            <div className={cn("p-2 rounded-lg", classes.primaryBgSubtle)}>
              <Heart className={cn("w-4 h-4", classes.primaryText)} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{user?.followersCount || 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
          </button>
          <button
            onClick={() => setShowFollowersModal(true)}
            className="group flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            aria-label="View following"
          >
            <div className={cn("p-2 rounded-lg", classes.primaryBgSubtle)}>
              <UserCheck className={cn("w-4 h-4", classes.primaryText)} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{user?.followingCount || 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </button>
          <div className="flex items-center gap-3 p-3 rounded-xl">
            <div className={cn("p-2 rounded-lg", classes.primaryBgSubtle)}>
              <Sparkles className={cn("w-4 h-4", classes.primaryText)} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{user?.score || 0}</p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl">
            <div className={cn("p-2 rounded-lg", classes.primaryBgSubtle)}>
              <Medal className={cn("w-4 h-4", classes.primaryText)} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">#{user?.rank || "-"}</p>
              <p className="text-xs text-muted-foreground">Global Rank</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tournaments Won"
          value={user?.tournamentsWon || 0}
          icon={Trophy}
          trend={user?.tournamentsWon && user.tournamentsWon > 0 ? "up" : "neutral"}
          trendValue={user?.tournamentsWon && user.tournamentsWon > 0 ? "+1 this month" : undefined}
          sparklineData={pointsTrendData}
          color="text-amber-500"
          bgColor="bg-amber-500/5 dark:bg-amber-500/10"
        />
        <StatCard
          title="Total Matches"
          value={user?.matches || 0}
          icon={Target}
          trend={user?.matches && user.matches > 5 ? "up" : "neutral"}
          trendValue={user?.matches && user.matches > 5 ? "+3 this week" : undefined}
          sparklineData={winsTrendData}
          color="text-blue-500"
          bgColor="bg-blue-500/5 dark:bg-blue-500/10"
        />
        <StatCard
          title="Current Streak"
          value={user?.currentStreak || 0}
          icon={Flame}
          trend={user?.currentStreak && user.currentStreak > 0 ? "up" : "neutral"}
          trendValue={
            user?.currentStreak && user.currentStreak > 0
              ? `Best: ${user?.bestStreak || 0}`
              : undefined
          }
          sparklineData={rankTrendData}
          color="text-orange-500"
          bgColor="bg-orange-500/5 dark:bg-orange-500/10"
        />
        <StatCard
          title="Best Streak"
          value={user?.bestStreak || 0}
          icon={Zap}
          trend="neutral"
          color="text-purple-500"
          bgColor="bg-purple-500/5 dark:bg-purple-500/10"
        />
      </div>

      {/* Performance and Ranking Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Overview Card */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Activity className={cn("w-5 h-5", classes.primaryText)} />
                Performance Overview
              </CardTitle>
              <Link href={`/${sport}/stats`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View Details
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Win/Loss Chart */}
              <div className="flex flex-col items-center justify-center">
                <WinLossChart
                  wins={user?.wins || 0}
                  losses={user?.losses || 0}
                  primaryColor={primaryColor}
                />
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">
                      Wins: <span className="font-semibold text-foreground">{user?.wins || 0}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-muted-foreground">
                      Losses: <span className="font-semibold text-foreground">{user?.losses || 0}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats and Form */}
              <div className="space-y-4">
                {/* Win Rate Display */}
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Win Rate</span>
                    <span className="text-2xl font-bold text-foreground">{winRatePercent}%</span>
                  </div>
                  <Progress value={winRatePercent} className="h-3" />
                </div>

                {/* Recent Form */}
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <RecentForm wins={user?.wins || 0} losses={user?.losses || 0} />
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">Wins</span>
                    </div>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {user?.wins || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-muted-foreground">Losses</span>
                    </div>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">
                      {user?.losses || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ranking Card */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className={cn("w-5 h-5", classes.primaryText)} />
              Your Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Rank */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
              <p className="text-sm text-muted-foreground mb-2">Current Rank</p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={cn(
                    "text-5xl font-bold",
                    classes.primaryText
                  )}
                >
                  #{user?.rank || "-"}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 mt-3">
                <ArrowUpRight className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  ↑ {rankChange} positions this month
                </span>
              </div>
            </div>

            {/* Progress to Next Rank */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress to #{Math.max(1, (user?.rank || 10) - 5)}</span>
                <span className="font-medium text-foreground">{pointsToNextRank} pts</span>
              </div>
              <Progress value={65} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Earn {pointsToNextRank} more points to advance
              </p>
            </div>

            {/* Elo Rating */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Elo Rating</p>
                  <p className="text-2xl font-bold text-foreground">{user?.elo || 1000}</p>
                </div>
                <div className={cn("p-3 rounded-lg", classes.primaryBgSubtle)}>
                  <TrendingUp className={cn("w-6 h-6", classes.primaryText)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Section - Upcoming Matches & Recent Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Matches */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calendar className={cn("w-5 h-5", classes.primaryText)} />
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
            <EmptyState
              icon={Calendar}
              title="No upcoming matches"
              description="Join a tournament to get started and find your next match."
              actionLabel="Find Tournaments"
              actionHref={`/${sport}/tournaments`}
              primaryBtnClass={classes.primaryBtn}
            />
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Play className={cn("w-5 h-5", classes.primaryText)} />
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
            <EmptyState
              icon={Trophy}
              title="No match results yet"
              description="Complete a tournament match to see your results here."
              actionLabel="Start Playing"
              actionHref={`/${sport}/tournaments`}
              primaryBtnClass={classes.primaryBtn}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tournament Progress */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Trophy className={cn("w-5 h-5", classes.primaryText)} />
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
          <EmptyState
            icon={Trophy}
            title="No active tournaments"
            description="You're not currently participating in any tournaments. Join one to track your progress!"
            actionLabel="Browse Tournaments"
            actionHref={`/${sport}/tournaments`}
            primaryBtnClass={classes.primaryBtn}
          />
        </CardContent>
      </Card>

      {/* Quick Actions Grid */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction
              icon={Search}
              label="Find Tournament"
              href={`/${sport}/tournaments`}
              color={classes.primaryText}
              bgColor={classes.primaryBgSubtle}
            />
            <QuickAction
              icon={BarChart3}
              label="My Stats"
              href={`/${sport}/stats`}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <QuickAction
              icon={Users}
              label="Leaderboard"
              href={`/${sport}/leaderboard`}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
            <QuickAction
              icon={UserCheck}
              label="Find Players"
              href={`/${sport}/players`}
              color="text-purple-500"
              bgColor="bg-purple-500/10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <ActivityFeedCard sport={sport} limit={5} />

      {/* Followers Modal */}
      {user && (
        <FollowersModal
          open={showFollowersModal}
          onOpenChange={setShowFollowersModal}
          userId={user.id}
          sport={sport}
          isCornhole={isCornhole}
        />
      )}
    </div>
  );
}
