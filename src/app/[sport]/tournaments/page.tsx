"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Medal,
  Search,
  Clock,
  Plus,
  Filter,
  X,
  ChevronRight,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  scope: string;
  location: string;
  city: string | null;
  district: string | null;
  state: string | null;
  startDate: string;
  endDate: string;
  prizePool: number;
  maxPlayers: number;
  registeredPlayers: number;
  entryFee: number;
  status: string;
  bracketFormat: string;
  gender: string | null;
  ageMin: number | null;
  ageMax: number | null;
}

interface MyTournament {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  city: string;
  state: string;
  type: string;
  scope: string;
  maxPlayers: number;
  registeredPlayers: number;
  entryFee: number;
  registrationId: string;
  registrationStatus: string;
  registrationDate: string;
  matchesPlayed?: number;
  matchesWon?: number;
  finalRank?: number | null;
}

const scopeColors: Record<string, string> = {
  CITY: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  DISTRICT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  STATE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  NATIONAL: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  REGISTRATION_OPEN: "bg-green-500/10 text-green-400",
  REGISTRATION_CLOSED: "bg-yellow-500/10 text-yellow-400",
  BRACKET_GENERATED: "bg-blue-500/10 text-blue-400",
  IN_PROGRESS: "bg-purple-500/10 text-purple-400",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-500/10 text-red-400",
};

const genderLabels: Record<string, string> = {
  MALE: "Men Only",
  FEMALE: "Women Only",
  MIXED: "Mixed",
};

// Indian states for filter
const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
  "Chandigarh", "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu", "Lakshadweep"
];

export default function TournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [ageCategoryFilter, setAgeCategoryFilter] = useState("all");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<"player" | "org" | null>(null);
  const [orgType, setOrgType] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [myTournaments, setMyTournaments] = useState<{
    upcoming: MyTournament[];
    active: MyTournament[];
    completed: MyTournament[];
  }>({ upcoming: [], active: [], completed: [] });
  const [myTournamentsLoading, setMyTournamentsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const allowedTabs = ["all", "my-tournaments", "upcoming", "completed"];
  const currentTab = allowedTabs.includes(searchParams.get("tab") || "")
    ? (searchParams.get("tab") as string)
    : "all";
  const myTournamentsLocked = userType !== "player";

  // Check if user is authenticated
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    async function checkAuth() {
      try {
        const playerRes = await fetch(`/api/auth/check?sport=${sport.toUpperCase()}`, {
          signal,
          credentials: "include",
        });
        if (signal.aborted) return;
        if (playerRes.ok) {
          const playerData = await playerRes.json();
          if (signal.aborted) return;
          if (playerData.authenticated && playerData.userType === "player") {
            setUserType("player");
            return;
          }
        }
        const orgRes = await fetch("/api/org/me", { signal, credentials: "include" });
        if (signal.aborted) return;
        if (orgRes.ok) {
          const data = await orgRes.json();
          setUserType("org");
          setOrgType(data.type);
          setOrgId(data.id);
          return;
        }
      } catch {
        // Not authenticated - spectator mode
      }
    }
    checkAuth();

    return () => {
      abortController.abort();
    };
  }, [sport]);

  // Determine if org is School or College
  const isSchoolOrCollege = userType === "org" && (orgType === "SCHOOL" || orgType === "COLLEGE");
  const orgTypeName = orgType === "SCHOOL" ? "School" : orgType === "COLLEGE" ? "College" : "Organization";

  useEffect(() => {
    // Abort any in-flight request from previous effect
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    async function fetchTournaments() {
      try {
        const params = new URLSearchParams();
        params.set("sport", sport.toUpperCase());
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (scopeFilter !== "all") params.set("scope", scopeFilter);
        if (stateFilter !== "all") params.set("state", stateFilter);
        if (districtFilter) params.set("district", districtFilter);
        if (genderFilter !== "all") params.set("gender", genderFilter);
        if (ageCategoryFilter !== "all") params.set("ageCategory", ageCategoryFilter);
        if (search) params.set("search", search);

        const res = await fetch(`/api/tournaments?${params.toString()}`, { signal });
        if (signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.tournaments && data.tournaments.length > 0) {
            setTournaments(data.tournaments.map((t: Tournament) => ({
              ...t,
              registeredPlayers: t.registeredPlayers || 0
            })));
          } else {
            setTournaments([]);
          }
        } else {
          setTournaments([]);
        }
      } catch {
        if (!signal.aborted) {
          setTournaments([]);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchTournaments();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [sport, statusFilter, scopeFilter, stateFilter, districtFilter, genderFilter, ageCategoryFilter, search]);

  useEffect(() => {
    if (userType !== "player") {
      setMyTournaments({ upcoming: [], active: [], completed: [] });
      return;
    }

    let cancelled = false;
    setMyTournamentsLoading(true);

    const fetchMyTournaments = async () => {
      try {
        const response = await fetch("/api/player/tournaments", {
          credentials: "include",
        });

        if (!response.ok) {
          setMyTournaments({ upcoming: [], active: [], completed: [] });
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setMyTournaments({
            upcoming: data.upcoming || [],
            active: data.active || [],
            completed: data.completed || [],
          });
        }
      } catch {
        if (!cancelled) {
          setMyTournaments({ upcoming: [], active: [], completed: [] });
        }
      } finally {
        if (!cancelled) {
          setMyTournamentsLoading(false);
        }
      }
    };

    fetchMyTournaments();

    return () => {
      cancelled = true;
    };
  }, [userType]);

  const filteredTournaments = tournaments.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase());
    const matchesScope = scopeFilter === "all" || t.scope === scopeFilter;
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesState = stateFilter === "all" || t.state === stateFilter;
    const matchesDistrict = !districtFilter || t.district?.toLowerCase().includes(districtFilter.toLowerCase());
    const matchesCountry = countryFilter === "all" || countryFilter === "India";
    const matchesGender = genderFilter === "all" || t.gender === genderFilter || (!t.gender && genderFilter === "all");
    
    // Age category filter: 
    // JUNIOR (U-14): tournaments for players under 14 (ageMax <= 14)
    // SENIOR (14+): tournaments for players 14 and above (ageMin >= 14 or no age restriction)
    let matchesAgeCategory = true;
    if (ageCategoryFilter === "JUNIOR") {
      matchesAgeCategory = t.ageMax !== null && t.ageMax <= 14;
    } else if (ageCategoryFilter === "SENIOR") {
      matchesAgeCategory = (t.ageMin !== null && t.ageMin >= 14) || (t.ageMin === null && t.ageMax === null);
    }
    
    return matchesSearch && matchesScope && matchesStatus && matchesState &&
           matchesDistrict && matchesCountry && matchesGender && matchesAgeCategory;
  });

  const upcomingTournaments = filteredTournaments.filter(t => 
    t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED"
  );
  const pastTournaments = filteredTournaments.filter(t => t.status === "COMPLETED");
  const myTournamentItems = [
    ...myTournaments.upcoming,
    ...myTournaments.active,
    ...myTournaments.completed,
  ];

  const clearAllFilters = () => {
    setScopeFilter("all");
    setStatusFilter("all");
    setCountryFilter("all");
    setStateFilter("all");
    setDistrictFilter("");
    setGenderFilter("all");
    setAgeCategoryFilter("all");
    setSearch("");
  };

  const hasActiveFilters = scopeFilter !== "all" || statusFilter !== "all" || 
    countryFilter !== "all" || stateFilter !== "all" || districtFilter ||
    genderFilter !== "all" || ageCategoryFilter !== "all" || search;

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `/${sport}/tournaments?${query}` : `/${sport}/tournaments`);
  };

  return (
    <div className="bg-muted/30 min-h-screen">
      {userType && <Sidebar userType={userType} />}
      <main className={cn(userType ? "ml-0 md:ml-72" : "", "overflow-x-hidden")}>
      <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tournaments</h1>
            <p className="text-muted-foreground mt-1">
              {isSchoolOrCollege 
                ? `Find tournaments for your ${orgTypeName.toLowerCase()} teams to participate in`
                : `Find and register for ${sportName.toLowerCase()} tournaments`}
            </p>
          </div>
          {/* Only show Create Tournament for org accounts (not School/College) */}
          {userType === "org" && !isSchoolOrCollege && (
            <div className="flex w-full gap-2 sm:w-auto">
              <Link href={`/${sport}/org/tournaments/create`}>
                <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
                  <Plus className="w-4 h-4" />
                  Create Tournament
                </Button>
              </Link>
            </div>
          )}
          {/* For School/College: Show Manage Teams button */}
          {isSchoolOrCollege && (
            <div className="flex w-full gap-2 sm:w-auto">
              <Link href={`/${sport}/org/${orgType === "SCHOOL" ? "school-teams" : "college-teams"}`}>
                <Button variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
                  <Users className="w-4 h-4" />
                  Manage Teams
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Search and Filter Toggle */}
        <Card className="bg-gradient-card border-border/50 mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tournaments by name or location..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  className="min-h-10 gap-2"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                      !
                    </Badge>
                  )}
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-10 gap-2 text-muted-foreground"
                    onClick={clearAllFilters}
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expanded Filters */}
        {showFilters && (
          <Card className="bg-gradient-card border-border/50 mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Country</label>
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Countries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      <SelectItem value="India">India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location Filters */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">State</label>
                  <Select value={stateFilter} onValueChange={setStateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {indianStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">District</label>
                  <Input
                    placeholder="Enter district..."
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                  />
                </div>

                {/* Tournament Scope */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Scope</label>
                  <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger>
                    <SelectValue placeholder="All Scopes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scopes</SelectItem>
                    <SelectItem value="DISTRICT">District</SelectItem>
                    <SelectItem value="STATE">State</SelectItem>
                    <SelectItem value="NATIONAL">National</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="REGISTRATION_OPEN">Open for Registration</SelectItem>
                      <SelectItem value="IN_PROGRESS">Live</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Gender Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Gender Category</label>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="MALE">Men Only</SelectItem>
                      <SelectItem value="FEMALE">Women Only</SelectItem>
                      <SelectItem value="MIXED">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Age Category Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Age Category</label>
                  <Select value={ageCategoryFilter} onValueChange={setAgeCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="JUNIOR">
                        <div className="flex flex-col items-start">
                          <span>Junior (U-14)</span>
                          <span className="text-xs text-muted-foreground">Born on or after Jan 1, 2012</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="SENIOR">
                        <div className="flex flex-col items-start">
                          <span>Senior (14+)</span>
                          <span className="text-xs text-muted-foreground">Born on or before Dec 31, 2011</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Filters Display */}
        {hasActiveFilters && !showFilters && (
          <div className="mb-4 flex flex-wrap gap-2">
            {scopeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Scope: {scopeFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setScopeFilter("all")} />
              </Badge>
            )}
            {countryFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Country: {countryFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setCountryFilter("all")} />
              </Badge>
            )}
            {stateFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                State: {stateFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStateFilter("all")} />
              </Badge>
            )}
            {districtFilter && (
              <Badge variant="secondary" className="gap-1">
                District: {districtFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setDistrictFilter("")} />
              </Badge>
            )}
            {genderFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {genderLabels[genderFilter] || genderFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setGenderFilter("all")} />
              </Badge>
            )}
            {ageCategoryFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                {ageCategoryFilter === "JUNIOR" ? "Junior (U-14)" : "Senior (14+)"}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setAgeCategoryFilter("all")} />
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="gap-1">
                Search: {search}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearch("")} />
              </Badge>
            )}
          </div>
        )}

        {/* Tournament Tabs */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="overflow-x-auto pb-2 -mb-2">
          <TabsList className="inline-flex h-auto min-w-max gap-1">
            <TabsTrigger value="all" className="gap-2">
              <Trophy className="w-4 h-4" />
              All Tournaments ({filteredTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="my-tournaments" className="gap-2" disabled={myTournamentsLocked}>
              {myTournamentsLocked ? <Lock className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              My Tournaments ({myTournamentItems.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming ({upcomingTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <Clock className="w-4 h-4" />
              Completed ({pastTournaments.length})
            </TabsTrigger>
          </TabsList>
          </div>

          {myTournamentsLocked ? (
            <p className="text-sm text-muted-foreground">
              Sign in as a player to unlock <span className="font-medium text-foreground">My Tournaments</span>.
            </p>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-gradient-card border-border/50">
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="all">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} sport={sport} isSchoolOrCollege={isSchoolOrCollege} />
                  ))}
                  {filteredTournaments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      No tournaments found matching your criteria
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="my-tournaments">
                {userType !== "player" ? (
                  <div className="rounded-lg border border-border/50 bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      My Tournaments is available for player registrations inside the current sport.
                    </p>
                  </div>
                ) : myTournamentsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="bg-gradient-card border-border/50">
                        <CardContent className="p-6 space-y-3">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-20 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : myTournamentItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myTournamentItems.map((tournament) => (
                      <MyTournamentCard key={tournament.registrationId} tournament={tournament} sport={sport} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/50 bg-card p-8 text-center">
                    <p className="text-sm text-muted-foreground">You have not joined any tournaments yet.</p>
                    <Link href={`/${sport}/tournaments`} className="mt-4 inline-flex">
                      <Button size="sm">Browse Tournaments</Button>
                    </Link>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} sport={sport} isSchoolOrCollege={isSchoolOrCollege} />
                  ))}
                  {upcomingTournaments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      No upcoming tournaments found matching your criteria
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="completed">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} sport={sport} isSchoolOrCollege={isSchoolOrCollege} />
                  ))}
                  {pastTournaments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      No completed tournaments found
                    </div>
                  )}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
      </div>
      </main>
    </div>
  );
}

function TournamentCard({ tournament, sport, isSchoolOrCollege = false }: { tournament: Tournament; sport: string; isSchoolOrCollege?: boolean }) {
  // Determine age category for display
  const getAgeCategoryLabel = () => {
    if (tournament.ageMax !== null && tournament.ageMax <= 14) {
      return { label: "Junior (U-14)", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
    }
    if (tournament.ageMin !== null && tournament.ageMin >= 14) {
      return { label: "Senior (14+)", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" };
    }
    return null; // Open category - no age restriction
  };
  
  const ageCategory = getAgeCategoryLabel();

  // Action button text based on user type
  const getActionText = () => {
    if (isSchoolOrCollege) {
      if (tournament.status === "REGISTRATION_OPEN") {
        return "Register Team";
      } else if (tournament.status === "IN_PROGRESS") {
        return "View Progress";
      } else if (tournament.status === "COMPLETED") {
        return "View Results";
      }
    }
    return null;
  };
  
  const actionText = getActionText();

  return (
    <Link href={`/${sport}/tournaments/${tournament.id}`}>
      <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all hover:scale-[1.01] cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg text-foreground line-clamp-2">{tournament.name}</CardTitle>
            <Badge variant="outline" className={scopeColors[tournament.scope] || ""}>
              {tournament.scope}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="line-clamp-1">
              {tournament.location}
              {tournament.city && ` • ${tournament.city}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 shrink-0" />
            {new Date(tournament.startDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Medal className="w-4 h-4 text-primary" />
              <span className="text-foreground font-medium">₹{(tournament.prizePool / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{tournament.registeredPlayers}/{tournament.maxPlayers}</span>
            </div>
          </div>
          
          {/* Gender and Age Category Badges */}
          {(tournament.gender || ageCategory) && (
            <div className="flex flex-wrap gap-2">
              {tournament.gender && (
                <Badge variant="outline" className="text-xs">
                  {tournament.gender === "MALE" ? "Men" : tournament.gender === "FEMALE" ? "Women" : "Mixed"}
                </Badge>
              )}
              {ageCategory && (
                <Badge variant="outline" className={`text-xs ${ageCategory.color}`}>
                  {ageCategory.label}
                </Badge>
              )}
            </div>
          )}
          
          <div className="pt-2 flex items-center justify-between border-t border-border/40">
            <Badge variant="outline" className={statusColors[tournament.status] || ""}>
              {tournament.status.replace(/_/g, " ")}
            </Badge>
            {actionText ? (
              <span className="text-sm font-medium text-primary">
                {actionText} →
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Entry: <span className="text-foreground font-medium">₹{tournament.entryFee}</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MyTournamentCard({ tournament, sport }: { tournament: MyTournament; sport: string }) {
  const getScopeColor = (scope: string) => {
    switch (scope) {
      case "NATIONAL":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "STATE":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "DISTRICT":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
      case "CITY":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Card className="bg-gradient-card border-border/50 hover:border-primary/30 transition-all h-full">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground">{tournament.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Registered on {new Date(tournament.registrationDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge variant="outline" className={getScopeColor(tournament.scope)}>
            {tournament.scope}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{new Date(tournament.startDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{tournament.city}, {tournament.state}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{tournament.registeredPlayers}/{tournament.maxPlayers} players</span>
          </div>
        </div>

        {(tournament.matchesPlayed || tournament.finalRank) ? (
          <div className="rounded-lg border border-border/50 bg-muted/40 p-3 text-sm">
            {tournament.matchesPlayed ? (
              <p className="text-foreground">
                Matches: <span className="font-medium">{tournament.matchesWon || 0}W</span> /{" "}
                <span className="font-medium">
                  {(tournament.matchesPlayed || 0) - (tournament.matchesWon || 0)}L
                </span>
              </p>
            ) : null}
            {tournament.finalRank ? (
              <p className="mt-1 text-foreground">Final Rank: <span className="font-medium">#{tournament.finalRank}</span></p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <span className="text-sm text-muted-foreground">
            Entry: <span className="font-medium text-foreground">INR {tournament.entryFee}</span>
          </span>
          <Link href={`/${sport}/tournaments/${tournament.id}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              View
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
