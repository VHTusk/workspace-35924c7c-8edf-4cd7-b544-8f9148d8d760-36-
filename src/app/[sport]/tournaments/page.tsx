"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  Eye,
  Filter,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

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
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [ageCategoryFilter, setAgeCategoryFilter] = useState("all");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<"player" | "org" | null>(null);
  const [orgType, setOrgType] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if user is authenticated
  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    async function checkAuth() {
      try {
        const playerRes = await fetch("/api/auth/check", { signal });
        if (signal.aborted) return;
        if (playerRes.ok) {
          setUserType("player");
          return;
        }
        const orgRes = await fetch("/api/org/me", { signal });
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
  }, []);

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
        if (cityFilter) params.set("city", cityFilter);
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
  }, [sport, statusFilter, scopeFilter, stateFilter, districtFilter, cityFilter, genderFilter, ageCategoryFilter, search]);

  const filteredTournaments = tournaments.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.location.toLowerCase().includes(search.toLowerCase());
    const matchesScope = scopeFilter === "all" || t.scope === scopeFilter;
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesState = stateFilter === "all" || t.state === stateFilter;
    const matchesDistrict = !districtFilter || t.district?.toLowerCase().includes(districtFilter.toLowerCase());
    const matchesCity = !cityFilter || t.city?.toLowerCase().includes(cityFilter.toLowerCase());
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
           matchesDistrict && matchesCity && matchesGender && matchesAgeCategory;
  });

  const upcomingTournaments = filteredTournaments.filter(t => 
    t.status === "REGISTRATION_OPEN" || t.status === "REGISTRATION_CLOSED"
  );
  const activeTournaments = filteredTournaments.filter(t => t.status === "IN_PROGRESS");
  const pastTournaments = filteredTournaments.filter(t => t.status === "COMPLETED");

  // For School/College: Show tab labels that make sense for team participation
  const canParticipateTournaments = upcomingTournaments; // Can register teams
  const participatingTournaments = activeTournaments; // Teams currently playing
  const participatedTournaments = pastTournaments; // Teams played in past

  const clearAllFilters = () => {
    setScopeFilter("all");
    setStatusFilter("all");
    setStateFilter("all");
    setDistrictFilter("");
    setCityFilter("");
    setGenderFilter("all");
    setAgeCategoryFilter("all");
    setSearch("");
  };

  const hasActiveFilters = scopeFilter !== "all" || statusFilter !== "all" || 
    stateFilter !== "all" || districtFilter || cityFilter || 
    genderFilter !== "all" || ageCategoryFilter !== "all" || search;

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Spectator Mode Indicator */}
        {!userType && (
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    You&apos;re in Spectator Mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Browse tournaments and view results. <Link href={`/${sport}/login`} className="text-primary hover:underline">Login</Link> or <Link href={`/${sport}/register`} className="text-primary hover:underline">Register</Link> to participate.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
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
            <div className="flex gap-2">
              <Link href={`/${sport}/org/tournaments/create`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Tournament
                </Button>
              </Link>
            </div>
          )}
          {/* For School/College: Show Manage Teams button */}
          {isSchoolOrCollege && (
            <div className="flex gap-2">
              <Link href={`/${sport}/org/${orgType === "SCHOOL" ? "school-teams" : "college-teams"}`}>
                <Button variant="outline" size="sm" className="gap-2">
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tournaments by name or location..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
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
                    className="gap-2 text-muted-foreground"
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

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">City</label>
                  <Input
                    placeholder="Enter city..."
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
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
                      <SelectItem value="CITY">City</SelectItem>
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
          <div className="flex flex-wrap gap-2 mb-4">
            {scopeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Scope: {scopeFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setScopeFilter("all")} />
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
            {cityFilter && (
              <Badge variant="secondary" className="gap-1">
                City: {cityFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setCityFilter("")} />
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
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            {isSchoolOrCollege ? (
              // School/College-specific tabs
              <>
                <TabsTrigger value="upcoming" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  Can Participate ({canParticipateTournaments.length})
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-2">
                  <Trophy className="w-4 h-4" />
                  Participating ({participatingTournaments.length})
                </TabsTrigger>
                <TabsTrigger value="past" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Participated ({participatedTournaments.length})
                </TabsTrigger>
              </>
            ) : (
              // Standard tabs for players and other orgs
              <>
                <TabsTrigger value="upcoming" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  Upcoming ({upcomingTournaments.length})
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-2">
                  <Trophy className="w-4 h-4" />
                  Live ({activeTournaments.length})
                </TabsTrigger>
                <TabsTrigger value="past" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Past ({pastTournaments.length})
                </TabsTrigger>
              </>
            )}
          </TabsList>

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
              <TabsContent value="upcoming">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} sport={sport} isSchoolOrCollege={isSchoolOrCollege} />
                  ))}
                  {upcomingTournaments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      {isSchoolOrCollege 
                        ? "No tournaments available for your teams to participate in"
                        : "No upcoming tournaments found matching your criteria"}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="live">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} sport={sport} isSchoolOrCollege={isSchoolOrCollege} />
                  ))}
                  {activeTournaments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      {isSchoolOrCollege 
                        ? "Your teams are not currently participating in any tournaments"
                        : "No live tournaments at the moment"}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="past">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastTournaments.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} sport={sport} isSchoolOrCollege={isSchoolOrCollege} />
                  ))}
                  {pastTournaments.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      {isSchoolOrCollege 
                        ? "Your teams haven't participated in any tournaments yet"
                        : "No past tournaments found"}
                    </div>
                  )}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
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
