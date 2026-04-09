"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Search,
  Crown,
  Medal,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Minus,
  User,
  Sparkles,
  Users,
  School,
  Building2,
  MapPin,
  Globe,
  Landmark,
  Filter,
  X,
  PersonStanding,
  Calendar,
  UsersRound,
  UserPlus,
  UserCheck,
  Loader2
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import FollowButton from "@/components/follow/follow-button";

interface LeaderboardPlayer {
  rank: number;
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  district: string | null;
  gender: string | null;
  ageCategory: string | null;
  points: number;
  tier: string;
  matches: number;
  wins: number;
  winRate: number;
}

interface LeaderboardStats {
  totalPlayers: number;
  activeThisMonth: number;
  topPlayer: string | null;
  topPlayerCity: string | null;
}

interface LeaderboardFilters {
  districts: string[];
  states: string[];
  genders: string[];
  ageCategories: string[];
}

interface CurrentUser {
  id: string;
  name: string;
  rank: number | null;
  points: number;
  tier: string;
}

const tierColors: Record<string, string> = {
  Diamond: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Platinum: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  Gold: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Silver: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  Bronze: "text-orange-400 bg-orange-500/10 border-orange-500/30",
};

const tierIcons: Record<string, string> = {
  Diamond: "💎",
  Platinum: "🔷",
  Gold: "🥇",
  Silver: "🥈",
  Bronze: "🥉",
};

const genderLabels: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  MIXED: "Mixed",
};

const ageCategoryLabels: Record<string, string> = {
  JUNIOR: "Junior (Under 18)",
  ADULT: "Adult (18-35)",
  SENIOR: "Senior (35-50)",
  VETERAN: "Veteran (50+)",
};

// Tab configuration with icons and labels - Only District, State, National
const leaderboardTabs = [
  { value: "district", label: "District", icon: Landmark, scope: "district" },
  { value: "state", label: "State", icon: MapPin, scope: "state" },
  { value: "national", label: "National", icon: Globe, scope: "national" },
];

// Skeleton components for loading states
function StatCardSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PodiumSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-card border-border/50">
          <CardContent className="p-4 text-center">
            <Skeleton className="w-8 h-8 mx-auto mb-2 rounded-full" />
            <Skeleton className="w-12 h-12 mx-auto mb-2 rounded-full" />
            <Skeleton className="h-4 w-24 mx-auto mb-1" />
            <Skeleton className="h-3 w-16 mx-auto mb-2" />
            <Skeleton className="h-5 w-16 mx-auto mb-2" />
            <Skeleton className="h-6 w-12 mx-auto mb-1" />
            <Skeleton className="h-5 w-8 mx-auto" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border/40">
      <td className="px-4 py-3"><Skeleton className="h-5 w-8" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-8 ml-auto" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-10 ml-auto" /></td>
    </tr>
  );
}

export default function LeaderboardPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";
  const sportType = isCornhole ? "CORNHOLE" : "DARTS";

  const primaryTextClass = isCornhole ? "text-green-500" : "text-teal-500";
  const primaryBgClass = isCornhole ? "bg-green-500/10" : "bg-teal-500/10";

  const [activeTab, setActiveTab] = useState("national");
  const [search, setSearch] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [stats, setStats] = useState<LeaderboardStats>({
    totalPlayers: 0,
    activeThisMonth: 0,
    topPlayer: null,
    topPlayerCity: null
  });
  const [filters, setFilters] = useState<LeaderboardFilters>({
    districts: [],
    states: [],
    genders: ['MALE', 'FEMALE', 'MIXED'],
    ageCategories: ['JUNIOR', 'ADULT', 'SENIOR', 'VETERAN']
  });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Dynamic filter state
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [ageCategoryFilter, setAgeCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Get the scope for the current tab
  const getCurrentScope = useCallback(() => {
    const tab = leaderboardTabs.find(t => t.value === activeTab);
    return tab?.scope || "national";
  }, [activeTab]);

  // Check if any filters are active
  const hasActiveFilters = genderFilter !== "all" || ageCategoryFilter !== "all" || locationFilter !== "all";

  // Clear all filters
  const clearFilters = () => {
    setGenderFilter("all");
    setAgeCategoryFilter("all");
    setLocationFilter("all");
  };

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope = getCurrentScope();
      const queryParams = new URLSearchParams({
        sport: sportType,
        scope: scope,
        limit: "100"
      });
      
      // Add search filter
      if (search) {
        queryParams.set("search", search);
      }

      // Add gender filter
      if (genderFilter && genderFilter !== "all") {
        queryParams.set("gender", genderFilter);
      }

      // Add age category filter
      if (ageCategoryFilter && ageCategoryFilter !== "all") {
        queryParams.set("ageCategory", ageCategoryFilter);
      }

      // Add location filter for district/state tabs
      if (locationFilter && locationFilter !== "all" && scope !== "national") {
        queryParams.set("location", locationFilter);
      }

      const response = await fetch(`/api/leaderboard?${queryParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setStats({
        totalPlayers: data.total || 0,
        activeThisMonth: data.activeThisMonth || 0,
        topPlayer: data.leaderboard?.[0]?.name || null,
        topPlayerCity: data.leaderboard?.[0]?.city || null
      });
      
      // Update available filters
      if (data.filters) {
        setFilters(prev => ({
          ...prev,
          districts: data.filters.districts || prev.districts,
          states: data.filters.states || prev.states,
        }));
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [sportType, activeTab, search, genderFilter, ageCategoryFilter, locationFilter, getCurrentScope]);

  // Fetch current user data and check authentication
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(`/api/auth/check?sport=${sport.toUpperCase()}`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated === true);
          
          if (data.authenticated) {
            const userRes = await fetch(`/api/player/me?sport=${sport.toUpperCase()}`, {
              credentials: "include",
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              setCurrentUser({
                id: userData.id,
                name: `${userData.firstName} ${userData.lastName}`,
                rank: userData.rank || null,
                points: userData.visiblePoints || userData.score || 0,
                tier: userData.tier || "Bronze"
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeaderboard();
    }, search ? 300 : 0);

    return () => clearTimeout(timer);
  }, [fetchLeaderboard]);

  // Reset location filter when tab changes
  useEffect(() => {
    setLocationFilter("all");
  }, [activeTab]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearch(""); // Reset search when changing tabs
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  // Find current user in leaderboard
  const userInLeaderboard = currentUser 
    ? leaderboard.find(p => p.id === currentUser.id)
    : null;

  // Get tab title based on active tab
  const getTabTitle = () => {
    const tab = leaderboardTabs.find(t => t.value === activeTab);
    return tab ? `${tab.label} Rankings` : "Rankings";
  };

  // Get available locations based on current scope
  const getAvailableLocations = () => {
    if (activeTab === "district") {
      return filters.districts;
    } else if (activeTab === "state") {
      return filters.states;
    }
    return [];
  };

  return (
    <div className="bg-muted/30 min-h-screen">
      {/* Only show sidebar when authenticated */}
      {isAuthenticated && <Sidebar userType="player" />}
      <main className={isAuthenticated ? "ml-0 md:ml-72" : ""}>
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Trophy className={cn("w-7 h-7", primaryTextClass)} />
              {sportName} Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">Top players ranked by points</p>
          </div>

          {/* Your Rank Card - Show if logged in */}
          {currentUser && !loading && (
            <Card className={cn("mb-6 border-l-4", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl", primaryBgClass)}>
                      <Sparkles className={cn("w-6 h-6", primaryTextClass)} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Your Rank</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">
                          #{userInLeaderboard?.rank || currentUser.rank || "—"}
                        </span>
                        {userInLeaderboard && (
                          <Badge variant="outline" className={tierColors[userInLeaderboard.tier] || ""}>
                            {userInLeaderboard.tier}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {userInLeaderboard?.points?.toLocaleString() || currentUser.points?.toLocaleString() || 0} points
                      </p>
                    </div>
                  </div>
                  <Link href={`/${sport}/stats`}>
                    <Badge className="cursor-pointer hover:bg-primary/20" variant="secondary">
                      View My Stats
                    </Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Top Player</p>
                        <p className="font-bold text-foreground truncate">
                          {stats.topPlayer || "No players yet"}
                        </p>
                        {stats.topPlayerCity && (
                          <p className="text-xs text-muted-foreground">{stats.topPlayerCity}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", primaryBgClass)}>
                        <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Players</p>
                        <p className="font-bold text-foreground">
                          {stats.totalPlayers.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Active This Month</p>
                        <p className="font-bold text-foreground">
                          {stats.activeThisMonth.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Leaderboard Tabs */}
          <Tabs defaultValue="national" value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="bg-card border border-border/50 rounded-lg p-4 mb-6">
              {/* Search and Filter Row */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                
                {/* Filter Toggle Button */}
                <Button
                  variant="outline"
                  className={cn("flex items-center gap-2", hasActiveFilters && isCornhole ? "border-green-500/50 bg-green-500/10" : hasActiveFilters && "border-teal-500/50 bg-teal-500/10")}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                      {[genderFilter !== "all", ageCategoryFilter !== "all", locationFilter !== "all"].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Expandable Filters Panel */}
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
                  {/* Gender Filter */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <PersonStanding className="w-4 h-4" />
                      Gender
                    </label>
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Genders" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        {filters.genders.map((g) => (
                          <SelectItem key={g} value={g}>
                            {genderLabels[g] || g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Age Category Filter */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Age Category
                    </label>
                    <Select value={ageCategoryFilter} onValueChange={setAgeCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Ages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Ages</SelectItem>
                        {filters.ageCategories.map((a) => (
                          <SelectItem key={a} value={a}>
                            {ageCategoryLabels[a] || a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location Filter - Only show for district/state tabs */}
                  {activeTab !== "national" && getAvailableLocations().length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {activeTab === "district" ? "District" : "State"}
                      </label>
                      <Select value={locationFilter} onValueChange={setLocationFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder={`All ${activeTab === "district" ? "Districts" : "States"}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All {activeTab === "district" ? "Districts" : "States"}</SelectItem>
                          {getAvailableLocations().map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Clear Filters Button */}
                  {hasActiveFilters && (
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Active Filters Display */}
              {hasActiveFilters && !showFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {genderFilter !== "all" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {genderLabels[genderFilter] || genderFilter}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-destructive" 
                        onClick={() => setGenderFilter("all")}
                      />
                    </Badge>
                  )}
                  {ageCategoryFilter !== "all" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {ageCategoryLabels[ageCategoryFilter] || ageCategoryFilter}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-destructive" 
                        onClick={() => setAgeCategoryFilter("all")}
                      />
                    </Badge>
                  )}
                  {locationFilter !== "all" && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {locationFilter}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-destructive" 
                        onClick={() => setLocationFilter("all")}
                      />
                    </Badge>
                  )}
                </div>
              )}

              {/* Tab List - Scrollable on mobile */}
              <div className="overflow-x-auto pb-2 -mb-2">
                <TabsList className={cn(
                  "inline-flex h-auto min-w-full p-1 gap-1",
                  "bg-muted/50"
                )}>
                  {leaderboardTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md",
                          "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                          isCornhole 
                            ? "data-[state=active]:text-green-600 data-[state=active]:bg-green-500/10" 
                            : "data-[state=active]:text-teal-600 data-[state=active]:bg-teal-500/10",
                          "whitespace-nowrap"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </div>

            {/* Tab Content */}
            {leaderboardTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                {/* Error State */}
                {error && (
                  <Card className="bg-destructive/10 border-destructive/30 mb-6">
                    <CardContent className="p-4 text-center text-destructive">
                      {error}
                    </CardContent>
                  </Card>
                )}

                {/* Empty State */}
                {!loading && leaderboard.length === 0 && !error && (
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-12 text-center">
                      <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No Players Found</h3>
                      <p className="text-muted-foreground">
                        {search || hasActiveFilters
                          ? "Try adjusting your search or filter criteria"
                          : "Be the first to register and top the leaderboard!"}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Top 3 Podium */}
                {loading ? (
                  <PodiumSkeleton />
                ) : (
                  !loading && leaderboard.length >= 3 && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {[1, 0, 2].map((index) => {
                        const player = leaderboard[index];
                        if (!player) return null;
                        const position = index === 1 ? 0 : index === 0 ? 1 : 2;
                        const isCurrentUser = currentUser?.id === player.id;
                        
                        return (
                          <Card
                            key={player.id}
                            className={cn(
                              "bg-card border-border/50 shadow-sm transition-all",
                              position === 0 && "order-2 scale-105 border-amber-500/30",
                              position === 1 && "order-1",
                              position === 2 && "order-3",
                              isCurrentUser && cn("ring-2", isCornhole ? "ring-green-500" : "ring-teal-500")
                            )}
                          >
                            <CardContent className={cn("p-4 text-center", position === 0 && "pt-6")}>
                              <div className="text-3xl mb-2">{tierIcons[player.tier] || "🎮"}</div>
                              <Link href={`/${sport}/players/${player.id}`}>
                                <Avatar className={cn(
                                  "mx-auto mb-2 cursor-pointer hover:ring-2 hover:ring-primary",
                                  position === 0 ? "w-16 h-16" : "w-12 h-12"
                                )}>
                                  <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-lg")}>
                                    {getInitials(player.name)}
                                  </AvatarFallback>
                                </Avatar>
                              </Link>
                              <Link href={`/${sport}/players/${player.id}`} className="hover:text-primary">
                                <p className="font-semibold text-foreground truncate flex items-center justify-center gap-1">
                                  {player.name}
                                  {isCurrentUser && <Badge variant="secondary" className="text-xs">You</Badge>}
                                </p>
                              </Link>
                              <p className="text-xs text-muted-foreground">{player.city || player.district || "-"}</p>
                              <Badge variant="outline" className={cn("mt-2", tierColors[player.tier] || "")}>
                                {player.tier}
                              </Badge>
                              <div className="mt-2">
                                <p className="text-2xl font-bold text-foreground">{player.points.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">points</p>
                              </div>
                              <div className={cn(
                                "text-2xl font-bold",
                                position === 0 ? "text-amber-400" :
                                position === 1 ? "text-gray-400" :
                                "text-orange-400"
                              )}>
                                #{player.rank}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )
                )}

                {/* Full Leaderboard */}
                {!loading && leaderboard.length > 0 && (
                  <Card className="bg-card border-border/50 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getTabTitle()}
                        {activeTab !== "rankings" && (
                          <Badge variant="outline" className={cn(
                            isCornhole ? "border-green-500/30 text-green-600" : "border-teal-500/30 text-teal-600"
                          )}>
                            {leaderboardTabs.find(t => t.value === activeTab)?.label}
                          </Badge>
                        )}
                        {hasActiveFilters && (
                          <Badge variant="secondary" className="text-xs">
                            Filtered
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-card z-10">
                            <tr className="border-b border-border/40">
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rank</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Player</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">Tier</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Points</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">Matches</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground hidden md:table-cell">Win Rate</th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground hidden lg:table-cell">Follow</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {loading ? (
                              Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} />)
                            ) : (
                              leaderboard.map((player) => {
                                const isCurrentUser = currentUser?.id === player.id;
                                return (
                                  <tr 
                                    key={player.id} 
                                    className={cn(
                                      "hover:bg-muted/50 transition-colors",
                                      isCurrentUser && cn("bg-primary/5", isCornhole ? "bg-green-500/5" : "bg-teal-500/5")
                                    )}
                                  >
                                    <td className="px-4 py-3">
                                      <span className={cn(
                                        "font-bold",
                                        player.rank <= 3 ? primaryTextClass : "text-foreground"
                                      )}>
                                        #{player.rank}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Link href={`/${sport}/players/${player.id}`} className="flex items-center gap-3 hover:opacity-80">
                                        <Avatar className="w-8 h-8">
                                          <AvatarFallback className={cn(primaryBgClass, primaryTextClass, "text-xs")}>
                                            {getInitials(player.name)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <p className="font-medium text-foreground flex items-center gap-2">
                                            {player.name}
                                            {isCurrentUser && (
                                              <Badge variant="secondary" className="text-xs">You</Badge>
                                            )}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {player.city || player.district || player.state || "-"}
                                            {player.gender && (
                                              <span className="ml-2 opacity-60">
                                                • {genderLabels[player.gender] || player.gender}
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                      </Link>
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                      <Badge variant="outline" className={tierColors[player.tier] || ""}>
                                        {player.tier}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-foreground">
                                      {player.points.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                                      {player.matches}
                                    </td>
                                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                                      {player.winRate}%
                                    </td>
                                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                                      <FollowButton
                                        targetType="user"
                                        targetId={player.id}
                                        sport={sport.toUpperCase()}
                                        size="sm"
                                        showText={false}
                                        variant="ghost"
                                      />
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
    </div>
  );
}
