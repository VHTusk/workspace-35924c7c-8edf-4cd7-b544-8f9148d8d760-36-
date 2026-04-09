'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Users, Trophy, Gamepad2, Search,
  TrendingUp, ChevronRight, Star, CheckCircle, Loader2, Zap, Home
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SportType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { indianStates, getDistrictsForState } from '@/lib/indian-locations';
import { fetchWithCsrf } from '@/lib/client-csrf';
import { toast } from 'sonner';

interface DistrictSummary {
  id: string;
  cityId: string;
  cityName: string;
  state: string;
  country: string;
  sport: SportType;
  playerCount: number;
  activePlayersCount: number;
  tournamentCount: number;
  matchCount: number;
  duelMatchCount: number;
  status: string;
}

interface DistrictsResponse {
  success: boolean;
  data: DistrictSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  state?: string;
  district?: string;
}

// Helper to generate cityId from district name and state
const generateCityId = (districtName: string, stateName: string, sportCode: string) => {
  const normalizedDistrict = districtName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedState = stateName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `VH-CITY-${normalizedDistrict}-${normalizedState}-${sportCode}`;
};

export default function DistrictsBrowsePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'players' | 'tournaments' | 'name'>('players');
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  
  // User location state
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [redirectingToDistrict, setRedirectingToDistrict] = useState(false);

  const userDistrictUrl = useMemo(() => {
    if (!userData?.district || !userData?.state) {
      return null;
    }

    const normalizedDistrict = userData.district.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normalizedState = userData.state.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sportCode = sport.toUpperCase();
    return `/${sport}/dashboard/district/VH-CITY-${normalizedDistrict}-${normalizedState}-${sportCode}`;
  }, [sport, userData?.district, userData?.state]);

  // Fetch user data first
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const sportUpper = sport.toUpperCase();
        const response = await fetch(`/api/player/me?sport=${sportUpper}`);
        if (response.ok) {
          const data = await response.json();
          setUserData(data);
          
          // If user doesn't have state/district, show location setup
          if (!data.state || !data.district) {
            setShowLocationSetup(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, [sport]);

  useEffect(() => {
    if (userDistrictUrl) {
      setRedirectingToDistrict(true);
      router.replace(userDistrictUrl);
    }
  }, [router, userDistrictUrl]);

  // Fetch districts
  useEffect(() => {
    const fetchDistricts = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/city?sport=${sport}`);
        const data: DistrictsResponse = await response.json();

        if (data.success) {
          setDistricts(data.data);

          // Extract unique states
          const states = [...new Set(data.data.map(c => c.state))].sort();
          setAvailableStates(states);
        }
      } catch (error) {
        console.error('Failed to fetch districts:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sport) {
      fetchDistricts();
    }
  }, [sport]);

  // Update available districts when state changes
  useEffect(() => {
    if (selectedState) {
      const stateObj = indianStates.find(s => s.name === selectedState);
      if (stateObj) {
        setAvailableDistricts(getDistrictsForState(stateObj.code));
      }
    } else {
      setAvailableDistricts([]);
    }
    setSelectedDistrict('');
  }, [selectedState]);

  // Save location and redirect to district page
  const handleSaveLocation = async () => {
    if (!selectedState || !selectedDistrict) {
      toast.error('Please select both state and district');
      return;
    }

    setSaving(true);
    try {
      const response = await fetchWithCsrf('/api/player/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          district: selectedDistrict,
        }),
      });

      if (response.ok) {
        toast.success('Location saved successfully!');
        setUserData((current) =>
          current
            ? {
                ...current,
                state: selectedState,
                district: selectedDistrict,
              }
            : current,
        );
        
        // Generate cityId and redirect to district page
        const normalizedDistrict = selectedDistrict.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const normalizedState = selectedState.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const sportCode = sport.toUpperCase();
        const cityId = `VH-CITY-${normalizedDistrict}-${normalizedState}-${sportCode}`;
        
        // Redirect to their district page
        router.push(`/${sport}/dashboard/district/${cityId}`);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save location');
      }
    } catch (error) {
      toast.error('Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  // Generate user's cityId for comparison
  const userCityId = userData?.district && userData?.state
    ? generateCityId(userData.district, userData.state, sport.toUpperCase())
    : null;

  // Check if a district is the user's home district
  const isUserDistrict = (district: DistrictSummary) => {
    return userCityId && district.cityId === userCityId;
  };

  // Check if a district is in the user's state
  const isUserState = (district: DistrictSummary) => {
    return userData?.state && district.state === userData.state && !isUserDistrict(district);
  };

  // Filter and sort districts - prioritize user's district, then same state, then others
  const filteredDistricts = districts
    .filter(district => {
      const matchesSearch = district.cityName.toLowerCase().includes(search.toLowerCase()) ||
        district.state.toLowerCase().includes(search.toLowerCase());
      const matchesState = stateFilter === 'all' || district.state === stateFilter;
      return matchesSearch && matchesState;
    })
    .sort((a, b) => {
      // Priority 1: User's own district always first
      const aIsUser = isUserDistrict(a);
      const bIsUser = isUserDistrict(b);
      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;

      // Priority 2: Same state districts before other states
      const aIsUserState = isUserState(a);
      const bIsUserState = isUserState(b);
      if (aIsUserState && !bIsUserState) return -1;
      if (!aIsUserState && bIsUserState) return 1;

      // Priority 3: Within same group, apply selected sort
      switch (sortBy) {
        case 'players':
          return b.activePlayersCount - a.activePlayersCount;
        case 'tournaments':
          return b.tournamentCount - a.tournamentCount;
        case 'name':
          return a.cityName.localeCompare(b.cityName);
        default:
          return 0;
      }
    });

  // Format district URL
  const getDistrictUrl = (district: DistrictSummary) => {
    return `/${sport}/dashboard/district/${district.cityId}`;
  };

  const primaryBgClass = isCornhole ? "bg-green-500/10" : "bg-teal-500/10";
  const primaryTextClass = isCornhole ? "text-green-500" : "text-teal-500";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (redirectingToDistrict) {
    return (
      <div className="p-6 max-w-6xl space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-4">
            <Loader2 className={cn("h-8 w-8 animate-spin", primaryTextClass)} />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Opening your district challenger zone</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Taking you directly to your saved district page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Zap className={cn("h-7 w-7", primaryTextClass)} />
          Challenger Mode
        </h1>
        <p className="text-muted-foreground mt-1">
          Find opponents in your district and challenge them to quick matches
        </p>
      </div>

      <Dialog open={showLocationSetup}>
        <DialogContent
          className="sm:max-w-xl"
          showCloseButton={false}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className={cn("h-5 w-5", primaryTextClass)} />
              Select your challenger location
            </DialogTitle>
            <DialogDescription>
              Choose the state and district you want to play from. We will use this to open your district challenger page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">State you want to play from</label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose the state you want to play from" />
                </SelectTrigger>
                <SelectContent>
                  {indianStates.map((state) => (
                    <SelectItem key={state.code} value={state.name}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">District you want to play from</label>
              <Select
                value={selectedDistrict}
                onValueChange={setSelectedDistrict}
                disabled={!selectedState}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedState
                        ? "Choose the district you want to play from"
                        : "Choose your playing state first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableDistricts.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveLocation}
              disabled={!selectedState || !selectedDistrict || saving}
              className={cn("text-white", primaryBtnClass)}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Save & Open My District
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User's District Card - Show only before redirect settles */}
      {userData?.state && userData?.district && !redirectingToDistrict && (
        <Card className={cn("border-l-4", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                  <MapPin className={cn("h-5 w-5", primaryTextClass)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your District</p>
                  <p className="font-semibold text-lg">{userData.district}, {userData.state}</p>
                </div>
              </div>
              <Link href={`/${sport}/dashboard/district/VH-CITY-${userData.district.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${userData.state.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${sport.toUpperCase()}`}>
                <Button className={cn("text-white", primaryBtnClass)}>
                  Go to My District
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search districts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {availableStates.map(state => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="players">Most Active Players</SelectItem>
              <SelectItem value="tournaments">Most Tournaments</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDistricts.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border/50 rounded-lg">
          <MapPin className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No districts found</h2>
          <p className="text-muted-foreground">
            {search || stateFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : `No ${sport} districts exist yet. Districts are created when players register from a location.`}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filteredDistricts.length} challenger zone{filteredDistricts.length !== 1 ? 's' : ''} available
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDistricts.map((district) => {
              const isHome = isUserDistrict(district);
              const isNearby = isUserState(district);

              return (
                <Link key={district.id} href={getDistrictUrl(district)}>
                  <Card className={cn(
                    "hover:shadow-lg transition-all cursor-pointer h-full",
                    // User's home district - special gradient styling
                    isHome && isCornhole && "bg-gradient-to-br from-green-500 to-green-600 text-white border-green-600 shadow-lg shadow-green-500/20",
                    isHome && !isCornhole && "bg-gradient-to-br from-teal-500 to-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/20",
                    // Same state districts - subtle highlight
                    isNearby && !isHome && "border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-600",
                    // Other districts - default
                    !isHome && !isNearby && "border-border/50 hover:border-primary/50 bg-card"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={cn(
                              "font-semibold text-lg",
                              isHome && "text-white"
                            )}>
                              {district.cityName}
                            </h3>
                            {/* Home district badge */}
                            {isHome && (
                              <Badge className="bg-white/95 text-green-800 text-[10px] px-2 py-0.5 border-0 font-semibold shadow-sm">
                                <Home className="h-3 w-3 mr-1" />
                                Your District
                              </Badge>
                            )}
                            {/* Nearby district badge */}
                            {isNearby && (
                              <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400 dark:border-amber-600 text-[10px] px-2 py-0.5">
                                <MapPin className="h-3 w-3 mr-1" />
                                Nearby
                              </Badge>
                            )}
                          </div>
                          <p className={cn(
                            "text-sm",
                            isHome ? "text-white/80" : "text-muted-foreground"
                          )}>
                            {district.state}
                          </p>
                        </div>
                        <Badge
                          variant={district.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={isHome ? "bg-white/20 text-white border-white/30" : ""}
                        >
                          {district.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className={cn(
                          "text-center p-2 rounded-lg",
                          isHome ? "bg-white/20" : "bg-blue-500/10"
                        )}>
                          <Users className={cn(
                            "h-4 w-4 mx-auto",
                            isHome ? "text-white" : "text-blue-500"
                          )} />
                          <p className="text-lg font-bold">{district.activePlayersCount}</p>
                          <p className={cn(
                            "text-xs",
                            isHome ? "text-white/70" : "text-muted-foreground"
                          )}>
                            Players
                          </p>
                        </div>
                        <div className={cn(
                          "text-center p-2 rounded-lg",
                          isHome ? "bg-white/20" : "bg-purple-500/10"
                        )}>
                          <Trophy className={cn(
                            "h-4 w-4 mx-auto",
                            isHome ? "text-white" : "text-purple-500"
                          )} />
                          <p className="text-lg font-bold">{district.tournamentCount}</p>
                          <p className={cn(
                            "text-xs",
                            isHome ? "text-white/70" : "text-muted-foreground"
                          )}>
                            Events
                          </p>
                        </div>
                        <div className={cn(
                          "text-center p-2 rounded-lg",
                          isHome ? "bg-white/20" : primaryBgClass
                        )}>
                          <Gamepad2 className={cn(
                            "h-4 w-4 mx-auto",
                            isHome ? "text-white" : primaryTextClass
                          )} />
                          <p className="text-lg font-bold">{district.duelMatchCount}</p>
                          <p className={cn(
                            "text-xs",
                            isHome ? "text-white/70" : "text-muted-foreground"
                          )}>
                            Duels
                          </p>
                        </div>
                      </div>

                      <div className={cn(
                        "flex items-center justify-between mt-4 pt-4",
                        isHome ? "border-t border-white/20" : "border-t border-border/50"
                      )}>
                        <div className={cn(
                          "flex items-center gap-1 text-sm",
                          isHome ? "text-white/80" : "text-muted-foreground"
                        )}>
                          <TrendingUp className="h-4 w-4" />
                          <span>{district.playerCount} total players</span>
                        </div>
                        <ChevronRight className={cn(
                          "h-5 w-5",
                          isHome ? "text-white/80" : "text-muted-foreground"
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
