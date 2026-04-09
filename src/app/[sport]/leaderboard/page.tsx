"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Filter,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import FollowButton from "@/components/follow/follow-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type LeaderboardView = "ranked" | "all" | "unranked";
type GeographyScope = "all" | "district" | "state" | "national";
type AgeGroup = "JUNIOR" | "ADULT" | "MASTERS";

interface LeaderboardPlayer {
  rank: number | null;
  id: string;
  name: string;
  location: string;
  genderLabel: string | null;
  ageGroup: AgeGroup | null;
  points: number;
  rating: number;
  tier: string;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  joinedOnLabel: string;
  status: "Ranked" | "Unranked" | "Inactive";
}

interface LeaderboardStats {
  totalRegisteredPlayers: number;
  totalRankedPlayers: number;
  totalUnrankedPlayers: number;
  activeThisMonth: number;
}

interface LeaderboardFilters {
  districts: string[];
  states: string[];
}

interface CurrentUserSummary {
  id: string;
  name: string;
  matchesPlayed: number;
  points: number;
  rating: number;
  rank: number | null;
  tier: string;
}

const viewTabs: { value: LeaderboardView; label: string }[] = [
  { value: "ranked", label: "Ranked" },
  { value: "all", label: "All Players" },
  { value: "unranked", label: "Unranked" },
];

const scopeOptions: { value: GeographyScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "district", label: "District" },
  { value: "state", label: "State" },
  { value: "national", label: "National" },
];

const ageGroupLabels: Record<AgeGroup, string> = {
  JUNIOR: "Junior",
  ADULT: "Adult",
  MASTERS: "Masters",
};

const statusClasses: Record<LeaderboardPlayer["status"], string> = {
  Ranked: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Unranked: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  Inactive: "bg-muted text-muted-foreground border-border",
};

function StatCardSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ showRank }: { showRank: boolean }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="grid grid-cols-12 gap-3 items-center">
          {showRank ? <Skeleton className="col-span-1 h-5 w-8" /> : null}
          <Skeleton className={cn(showRank ? "col-span-3" : "col-span-4", "h-10")} />
          <Skeleton className="col-span-2 h-5" />
          <Skeleton className="col-span-2 h-5" />
          <Skeleton className="col-span-2 h-5" />
          <Skeleton className="col-span-2 h-5" />
        </div>
      ))}
    </div>
  );
}

function formatJoinedOn(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LeaderboardPage() {
  const params = useParams();
  const sport = params.sport as string;
  const sportType = sport.toUpperCase();
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-500/10" : "bg-teal-500/10";
  const primaryBorderClass = isCornhole ? "border-green-500/30" : "border-teal-500/30";

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserSummary, setCurrentUserSummary] = useState<CurrentUserSummary | null>(null);

  const [view, setView] = useState<LeaderboardView>("ranked");
  const [scope, setScope] = useState<GeographyScope>("all");
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const [sort, setSort] = useState("rank");
  const [showPrimaryFilters, setShowPrimaryFilters] = useState(false);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [minMatches, setMinMatches] = useState("");
  const [minWinRate, setMinWinRate] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [stats, setStats] = useState<LeaderboardStats>({
    totalRegisteredPlayers: 0,
    totalRankedPlayers: 0,
    totalUnrankedPlayers: 0,
    activeThisMonth: 0,
  });
  const [filters, setFilters] = useState<LeaderboardFilters>({ districts: [], states: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasPrimaryFilters =
    scope !== "all" || region !== "all" || gender !== "all" || ageGroup !== "all" || search.trim().length > 0;
  const hasSecondaryFilters = minMatches || minWinRate || minPoints || maxPoints || minRating || maxRating;
  const currentRegionOptions = scope === "district" ? filters.districts : scope === "state" ? filters.states : [];

  useEffect(() => {
    if (view === "ranked") {
      if (!["rank", "points", "winRate"].includes(sort)) {
        setSort("rank");
      }
    } else if (!["joinedOn_desc", "joinedOn_asc", "name_asc", "name_desc"].includes(sort)) {
      setSort("joinedOn_desc");
    }
  }, [sort, view]);

  useEffect(() => {
    setRegion("all");
  }, [scope]);

  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const authRes = await fetch(`/api/auth/check?sport=${sportType}`, { credentials: "include" });
        if (!authRes.ok) return;
        const authData = await authRes.json();
        if (authData.authenticated === true) {
          setIsAuthenticated(true);
          const meRes = await fetch(`/api/player/me?sport=${sportType}`, { credentials: "include" });
          if (meRes.ok) {
            const meData = await meRes.json();
            setCurrentUserId(meData.id);
          }
        }
      } catch (fetchError) {
        console.error("Failed to check auth for leaderboard:", fetchError);
      }
    };

    fetchAuth();
  }, [sportType]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sport: sportType,
        view,
        scope,
        sort,
        limit: "250",
      });

      if (region !== "all") params.set("region", region);
      if (search.trim()) params.set("search", search.trim());
      if (gender !== "all") params.set("gender", gender);
      if (ageGroup !== "all") params.set("ageGroup", ageGroup);
      if (view === "ranked") {
        if (minMatches) params.set("minMatches", minMatches);
        if (minWinRate) params.set("minWinRate", minWinRate);
        if (minPoints) params.set("minPoints", minPoints);
        if (maxPoints) params.set("maxPoints", maxPoints);
        if (minRating) params.set("minRating", minRating);
        if (maxRating) params.set("maxRating", maxRating);
      }

      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();

      setPlayers(data.players || data.leaderboard || []);
      setStats({
        totalRegisteredPlayers: data.stats?.totalRegisteredPlayers || data.totalRegisteredPlayers || 0,
        totalRankedPlayers: data.stats?.totalRankedPlayers || data.totalRankedPlayers || 0,
        totalUnrankedPlayers: data.stats?.totalUnrankedPlayers || data.totalUnrankedPlayers || 0,
        activeThisMonth: data.stats?.activeThisMonth || data.activeThisMonth || 0,
      });
      setFilters({
        districts: data.filters?.districts || [],
        states: data.filters?.states || [],
      });
    } catch (fetchError) {
      console.error("Failed to fetch leaderboard:", fetchError);
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [ageGroup, gender, maxPoints, maxRating, minMatches, minPoints, minRating, minWinRate, region, scope, search, sort, sportType, view]);

  const fetchCurrentUserSummary = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const params = new URLSearchParams({
        sport: sportType,
        view: "ranked",
        scope: "all",
        currentUserId,
        limit: "1",
      });
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      setCurrentUserSummary(data.currentUser || null);
    } catch (fetchError) {
      console.error("Failed to fetch current user leaderboard summary:", fetchError);
    }
  }, [currentUserId, sportType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeaderboard();
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchLeaderboard, search]);

  useEffect(() => {
    fetchCurrentUserSummary();
  }, [fetchCurrentUserSummary]);

  const clearAllFilters = () => {
    setScope("all");
    setRegion("all");
    setSearch("");
    setGender("all");
    setAgeGroup("all");
    setMinMatches("");
    setMinWinRate("");
    setMinPoints("");
    setMaxPoints("");
    setMinRating("");
    setMaxRating("");
    setSort(view === "ranked" ? "rank" : "joinedOn_desc");
  };

  const shareRegistrationLink = async () => {
    const shareUrl = `${window.location.origin}/${sport}?auth=register`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${sportName} on ValorHive`,
          text: `Join ${sportName} on ValorHive and start competing.`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Registration link copied");
      }
    } catch (shareError) {
      console.error("Failed to share leaderboard link:", shareError);
    }
  };

  const rankCardLocked = !currentUserSummary || currentUserSummary.matchesPlayed === 0 || stats.totalRankedPlayers === 0;

  const emptyState = useMemo(() => {
    if (stats.totalRegisteredPlayers === 0) {
      return {
        title: "No players registered in this sport yet",
        description: "Invite players to join early and help start the competitive ladder in this sport.",
        primaryLabel: "Invite players",
        primaryAction: shareRegistrationLink,
        secondaryHref: `/${sport}?auth=register`,
        secondaryLabel: "Start your profile",
      };
    }
    if (view === "ranked" && stats.totalRankedPlayers === 0) {
      return {
        title: "No ranked players yet",
        description: "Play the first official match to appear on the ranked leaderboard.",
        primaryHref: `/${sport}/tournaments`,
        primaryLabel: "Play your first match",
      };
    }
    if (hasPrimaryFilters || (view === "ranked" && hasSecondaryFilters)) {
      return {
        title: "No players match your filters",
        description: "Try clearing some filters or searching a broader region.",
        primaryLabel: "Clear filters",
        primaryAction: clearAllFilters,
      };
    }
    if (view === "unranked") {
      return {
        title: "No unranked players right now",
        description: "Everyone visible here has already played at least one official match.",
      };
    }
    return {
      title: "No players found",
      description: "Try again in a moment or adjust your filters.",
    };
  }, [hasPrimaryFilters, hasSecondaryFilters, sport, sportName, stats.totalRankedPlayers, stats.totalRegisteredPlayers, view]);

  return (
    <div className="min-h-screen bg-muted/30">
      {isAuthenticated ? <Sidebar userType="player" /> : null}
      <main className={cn(isAuthenticated ? "ml-0 md:ml-72" : "", "min-h-screen overflow-x-hidden")}>
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-6">
            <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
              <Trophy className={cn("h-7 w-7", primaryTextClass)} />
              {sportName} Leaderboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Separate competitive rankings from player discovery, with ranked, all-player, and unranked views.
            </p>
          </div>

          {isAuthenticated && currentUserSummary ? (
            <Card className={cn("mb-6 border-l-4", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn("rounded-xl p-3", primaryBgClass)}>
                    <Crown className={cn("h-6 w-6", primaryTextClass)} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your leaderboard status</p>
                    {rankCardLocked ? (
                      <>
                        <p className="text-lg font-semibold text-foreground">You are not ranked yet</p>
                        <p className="text-sm text-muted-foreground">
                          Matches played: {currentUserSummary.matchesPlayed}. Play your first match to enter leaderboard.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-2xl font-bold text-foreground">#{currentUserSummary.rank}</span>
                          <Badge variant="outline" className={primaryBorderClass}>
                            {currentUserSummary.tier}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {currentUserSummary.points.toLocaleString()} points • Rating {currentUserSummary.rating}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/${sport}/tournaments`}>
                    <Button className={cn("text-white", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}>
                      Play your first match
                    </Button>
                  </Link>
                  <Link href={`/${sport}/stats`}>
                    <Button variant="outline">View My Stats</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card className="bg-card border-border/50 shadow-sm"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Registered Players</p><p className="mt-1 text-2xl font-bold text-foreground">{stats.totalRegisteredPlayers.toLocaleString()}</p></CardContent></Card>
                <Card className="bg-card border-border/50 shadow-sm"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Ranked Players</p><p className="mt-1 text-2xl font-bold text-foreground">{stats.totalRankedPlayers.toLocaleString()}</p></CardContent></Card>
                <Card className="bg-card border-border/50 shadow-sm"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active This Month</p><p className="mt-1 text-2xl font-bold text-foreground">{stats.activeThisMonth.toLocaleString()}</p></CardContent></Card>
                <Card className="bg-card border-border/50 shadow-sm"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Unranked Players</p><p className="mt-1 text-2xl font-bold text-foreground">{stats.totalUnrankedPlayers.toLocaleString()}</p></CardContent></Card>
              </>
            )}
          </div>

          <Tabs value={view} onValueChange={(value) => setView(value as LeaderboardView)} className="w-full">
            <div className="mb-6 rounded-xl border border-border/50 bg-card p-4">
              <div className="overflow-x-auto pb-2">
                <TabsList className="inline-flex min-w-full gap-1 bg-muted/50 sm:min-w-0">
                  {viewTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        "px-4 py-2 whitespace-nowrap",
                        isCornhole ? "data-[state=active]:bg-green-500/10 data-[state=active]:text-green-700" : "data-[state=active]:bg-teal-500/10 data-[state=active]:text-teal-700",
                      )}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, city, or state" className="pl-10" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowPrimaryFilters((value) => !value)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {showPrimaryFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                  </Button>
                  {view === "ranked" ? (
                    <Button variant="outline" onClick={() => setShowSecondaryFilters((value) => !value)}>
                      Performance
                      {showSecondaryFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                    </Button>
                  ) : null}
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {view === "ranked" ? (
                        <>
                          <SelectItem value="rank">Rank</SelectItem>
                          <SelectItem value="points">Points</SelectItem>
                          <SelectItem value="winRate">Win %</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="joinedOn_desc">Join Date: Newest</SelectItem>
                          <SelectItem value="joinedOn_asc">Join Date: Oldest</SelectItem>
                          <SelectItem value="name_asc">Name: A-Z</SelectItem>
                          <SelectItem value="name_desc">Name: Z-A</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {showPrimaryFilters ? (
                <div className="mt-4 grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Geography Scope</label>
                    <Select value={scope} onValueChange={(value) => setScope(value as GeographyScope)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {scopeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Region</label>
                    <Select value={region} onValueChange={setRegion} disabled={currentRegionOptions.length === 0}>
                      <SelectTrigger><SelectValue placeholder={currentRegionOptions.length > 0 ? "Choose region" : "No region filter"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All regions</SelectItem>
                        {currentRegionOptions.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Gender</label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Age Group</label>
                    <Select value={ageGroup} onValueChange={setAgeGroup}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="JUNIOR">Junior (≤18)</SelectItem>
                        <SelectItem value="ADULT">Adult (19–35)</SelectItem>
                        <SelectItem value="MASTERS">Masters (36+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {view === "ranked" && showSecondaryFilters ? (
                <div className="mt-4 grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Minimum Matches</label><Input value={minMatches} onChange={(event) => setMinMatches(event.target.value)} inputMode="numeric" /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Minimum Win %</label><Input value={minWinRate} onChange={(event) => setMinWinRate(event.target.value)} inputMode="numeric" /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Minimum Points</label><Input value={minPoints} onChange={(event) => setMinPoints(event.target.value)} inputMode="numeric" /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Maximum Points</label><Input value={maxPoints} onChange={(event) => setMaxPoints(event.target.value)} inputMode="numeric" /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Minimum Rating</label><Input value={minRating} onChange={(event) => setMinRating(event.target.value)} inputMode="numeric" /></div>
                  <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Maximum Rating</label><Input value={maxRating} onChange={(event) => setMaxRating(event.target.value)} inputMode="numeric" /></div>
                </div>
              ) : null}

              {(hasPrimaryFilters || hasSecondaryFilters) ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {hasPrimaryFilters ? <Badge variant="secondary">Primary filters active</Badge> : null}
                  {view === "ranked" && hasSecondaryFilters ? <Badge variant="secondary">Performance filters active</Badge> : null}
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>Clear all</Button>
                </div>
              ) : null}
            </div>

            {viewTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                {error ? (
                  <Card className="border-destructive/30 bg-destructive/10">
                    <CardContent className="p-4 text-destructive">{error}</CardContent>
                  </Card>
                ) : null}

                {loading ? (
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardContent className="p-0">
                      <TableSkeleton showRank={tab.value === "ranked"} />
                    </CardContent>
                  </Card>
                ) : players.length === 0 ? (
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                      <Users className="h-12 w-12 text-muted-foreground" />
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-foreground">{emptyState.title}</h3>
                        <p className="max-w-xl text-sm text-muted-foreground">{emptyState.description}</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {"primaryHref" in emptyState && emptyState.primaryHref ? (
                          <Link href={emptyState.primaryHref}>
                            <Button className={cn("text-white", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}>
                              {emptyState.primaryLabel}
                            </Button>
                          </Link>
                        ) : null}
                        {"primaryAction" in emptyState && emptyState.primaryAction ? (
                          <Button
                            onClick={() => {
                              void emptyState.primaryAction();
                            }}
                            className={cn("text-white", isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700")}
                          >
                            {emptyState.primaryLabel}
                          </Button>
                        ) : null}
                        {"secondaryHref" in emptyState && emptyState.secondaryHref ? (
                          <Link href={emptyState.secondaryHref}>
                            <Button variant="outline">{emptyState.secondaryLabel}</Button>
                          </Link>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/50 bg-card shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        {tab.value === "ranked"
                          ? "Ranked players"
                          : tab.value === "all"
                            ? "Registered player directory"
                            : "Unranked players"}
                      </CardTitle>
                      <CardDescription>
                        {tab.value === "ranked"
                          ? "Only players with at least one official match appear here."
                          : tab.value === "all"
                            ? "All registered players in this sport, whether ranked or not."
                            : "Players with zero official matches are listed here until they enter the competitive ladder."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-[860px] w-full">
                          <thead className="bg-muted/40">
                            <tr className="border-b border-border/40">
                              {tab.value === "ranked" ? (
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rank</th>
                              ) : null}
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                              {tab.value === "ranked" ? (
                                <>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Matches</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Wins</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Win %</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Points / Rating</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Gender</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Age Group</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Joined On</th>
                                  {tab.value === "all" ? (
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Matches Played</th>
                                  ) : null}
                                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                </>
                              )}
                              {isAuthenticated ? (
                                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Action</th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {players.map((player) => {
                              const isCurrentUser = currentUserId === player.id;
                              return (
                                <tr key={player.id} className={cn("hover:bg-muted/30", isCurrentUser && "bg-primary/5")}>
                                  {tab.value === "ranked" ? (
                                    <td className="px-4 py-3 align-top">
                                      <span className={cn("font-semibold", primaryTextClass)}>#{player.rank}</span>
                                    </td>
                                  ) : null}
                                  <td className="px-4 py-3 align-top">
                                    <Link href={`/${sport}/players/${player.id}`} className="font-medium text-foreground hover:text-primary">
                                      {player.name}
                                    </Link>
                                    {isCurrentUser ? (
                                      <Badge variant="secondary" className="ml-2 text-xs">
                                        You
                                      </Badge>
                                    ) : null}
                                  </td>
                                  {tab.value === "ranked" ? (
                                    <>
                                      <td className="px-4 py-3 text-sm text-muted-foreground">{player.location || "-"}</td>
                                      <td className="px-4 py-3 text-right text-sm text-foreground">{player.matchesPlayed}</td>
                                      <td className="px-4 py-3 text-right text-sm text-foreground">{player.wins}</td>
                                      <td className="px-4 py-3 text-right text-sm text-foreground">{player.winRate}%</td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="text-sm font-semibold text-foreground">{player.points.toLocaleString()}</div>
                                        <div className="text-xs text-muted-foreground">Rating {player.rating}</div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-4 py-3 text-sm text-muted-foreground">{player.genderLabel || "-"}</td>
                                      <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {player.ageGroup ? ageGroupLabels[player.ageGroup] : "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-muted-foreground">{player.location || "-"}</td>
                                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatJoinedOn(player.joinedOnLabel)}</td>
                                      {tab.value === "all" ? (
                                        <td className="px-4 py-3 text-right text-sm text-foreground">{player.matchesPlayed}</td>
                                      ) : null}
                                      <td className="px-4 py-3">
                                        <Badge variant="outline" className={statusClasses[player.status]}>
                                          {player.status}
                                        </Badge>
                                      </td>
                                    </>
                                  )}
                                  {isAuthenticated ? (
                                    <td className="px-4 py-3 text-center">
                                      {!isCurrentUser ? (
                                        <FollowButton targetType="user" targetId={player.id} sport={sportType} showText={false} size="sm" />
                                      ) : (
                                        <span className="text-xs text-muted-foreground">Current player</span>
                                      )}
                                    </td>
                                  ) : null}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}

            {view === "ranked" && !loading && stats.totalRankedPlayers > 0 ? (
              <div className="mt-6">
                <Card className="border-border/50 bg-card shadow-sm">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Competition signal</p>
                      <p className="text-sm text-muted-foreground">
                        Top players move up as official matches are recorded. Keep playing to improve your standing.
                      </p>
                    </div>
                    <Link href={`/${sport}/tournaments`}>
                      <Button variant="outline">Join a tournament</Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            ) : null}

          </Tabs>
        </div>
      </main>
    </div>
  );
}
