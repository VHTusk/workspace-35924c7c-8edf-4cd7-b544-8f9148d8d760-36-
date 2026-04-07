'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Users, Trophy, Gamepad2, Calendar, TrendingUp,
  ChevronRight, Target, Zap, Award, CheckCircle,
  AlertCircle, ArrowRight, Star, Plus, Lock, Eye, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { SportType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { ChallengeMatchCard } from '@/components/challenge-match/ChallengeMatchCard';
import { CreateChallengeMatchModal } from '@/components/challenge-match/CreateChallengeMatchModal';
import { TournamentStatusBadge } from '@/components/tournament/tournament-status-badge';

// Types
interface DistrictData {
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
  activePolls: number;
  totalPolls: number;
  totalActivities: number;
  status: string;
}

interface LeaderboardEntry {
  userId: string;
  playerName: string;
  playerRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  rank: number;
}

interface ActivityItem {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  activityAt: string;
  isFeatured: boolean;
}

interface Tournament {
  id: string;
  name: string;
  type: string;
  scope: string;
  startDate: string;
  endDate: string;
  location: string;
  city: string;
  entryFee: number;
  prizePool: number | null;
  maxPlayers: number;
  participants: number;
  status: string;
  isRegistrationOpen: boolean;
  organizer: string;
  organizerType: string;
}

interface InterestPoll {
  id: string;
  title: string;
  description: string | null;
  proposedDate: string | null;
  minPlayers: number;
  maxPlayers: number;
  interestedCount: number;
  status: string;
  progress: number;
  remainingPlayers: number;
  expiresAt: string;
}

interface ChallengeMatch {
  id: string;
  title: string;
  description: string | null;
  matchDate: string;
  registrationDeadline: string;
  venueName: string;
  venueAddress: string | null;
  venueMapsUrl: string | null;
  format: string;
  minPlayers: number;
  maxPlayers: number;
  entryFee: number;
  joinedCount: number;
  confirmedCount: number;
  totalPrizePool: number;
  daysRemaining: number;
  progress: number;
  remainingSlots: number;
  needsMore: number;
  status: string;
  sponsorName: string | null;
  sponsorLogo: string | null;
  sponsorAmount: number;
  sport: string;
}

export default function DistrictPage() {
  const params = useParams();
  const router = useRouter();
  const districtId = params.districtId as string;
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [district, setDistrict] = useState<DistrictData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [challengeMatches, setChallengeMatches] = useState<ChallengeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [userId, setUserId] = useState<string | null>(null);
  const [userDistrict, setUserDistrict] = useState<string | null>(null);
  const [userState, setUserState] = useState<string | null>(null);
  const [joinedMatches, setJoinedMatches] = useState<Set<string>>(new Set());
  const [paidMatches, setPaidMatches] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Generate cityId from district name and state (same pattern as elsewhere in app)
  const generateCityId = (districtName: string, stateName: string, sportCode: string) => {
    const normalizedDistrict = districtName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normalizedState = stateName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `VH-CITY-${normalizedDistrict}-${normalizedState}-${sportCode}`;
  };

  // Calculate challenger permissions - compare generated cityId with URL districtId
  const userCityId = userDistrict && userState 
    ? generateCityId(userDistrict, userState, sport.toUpperCase()) 
    : null;
  const hasNoDistrict = userId && !userDistrict;
  const isViewOnly = userId && userCityId && userCityId !== districtId;
  const canParticipate = userId && userCityId === districtId;
  const restrictionType = hasNoDistrict ? 'no-district' : isViewOnly ? 'other-district' : null;

  // Get current user and district
  useEffect(() => {
    const getUserInfo = async () => {
      if (!sport) return;
      
      try {
        setAuthLoading(true);
        
        const res = await fetch(`/api/auth/check?sport=${sport.toUpperCase()}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          console.error('Auth check failed:', res.status, errorData);
          setUserId(null);
          setUserDistrict(null);
          setUserState(null);
          return;
        }

        const data = await res.json();

        if (data?.authenticated && data?.user) {
          setUserId(data.user.id);
          setUserDistrict(data.user.district || null);
          setUserState(data.user.state || null);
        } else {
          setUserId(null);
          setUserDistrict(null);
          setUserState(null);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setUserId(null);
        setUserDistrict(null);
        setUserState(null);
      } finally {
        setAuthLoading(false);
      }
    };
    
    getUserInfo();
  }, [sport]);

  // Fetch all district data
  useEffect(() => {
    const fetchDistrictData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all modules in parallel
        const [overviewRes, leaderboardRes, feedRes, tournamentsRes, challengeRes] = await Promise.all([
          fetch(`/api/city/${districtId}`),
          fetch(`/api/city/${districtId}/leaderboard?limit=10`),
          fetch(`/api/city/${districtId}/feed?limit=10`),
          fetch(`/api/city/${districtId}/tournaments?limit=5`),
          fetch(`/api/challenge-match?cityId=${districtId}&sport=${sport.toUpperCase()}&limit=10`),
        ]);

        if (!overviewRes.ok) {
          throw new Error('District not found');
        }

        const overviewData = await overviewRes.json();
        const leaderboardData = await leaderboardRes.json();
        const feedData = await feedRes.json();
        const tournamentsData = await tournamentsRes.json();
        const challengeData = await challengeRes.json();

        setDistrict(overviewData.data);
        setLeaderboard(leaderboardData.data?.leaderboard || []);
        setFeed(feedData.data?.feed || []);
        setTournaments(tournamentsData.data?.tournaments || []);
        setChallengeMatches(challengeData.data?.matches || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load district data');
      } finally {
        setLoading(false);
      }
    };

    if (districtId) {
      fetchDistrictData();
    }
  }, [districtId, sport]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  // Activity type styling
  const getActivityStyle = (type: string) => {
    switch (type) {
      case 'DUEL_RESULT':
        return { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      case 'TOURNAMENT_ANNOUNCEMENT':
        return { icon: Trophy, color: 'text-purple-500', bg: 'bg-purple-500/10' };
      case 'NEW_PLAYER':
        return { icon: Users, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'ACHIEVEMENT':
        return { icon: Award, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      default:
        return { icon: Star, color: 'text-gray-500', bg: 'bg-gray-500/10' };
    }
  };

  const primaryBgClass = isCornhole ? "bg-green-500/10" : "bg-teal-500/10";
  const primaryTextClass = isCornhole ? "text-green-500" : "text-teal-500";
  const primaryBorderClass = isCornhole ? "border-green-500/30" : "border-teal-500/30";
  const primaryBtnClass = isCornhole ? "bg-green-500 hover:bg-green-600" : "bg-teal-500 hover:bg-teal-600";

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !district) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">District Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || 'The requested district page does not exist.'}</p>
            <Link href={`/${sport}/dashboard/districts`}>
              <Button>Browse All Districts</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Link href={`/${sport}/dashboard`} className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/${sport}/dashboard/districts`} className="hover:text-foreground">Districts</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{district.cityName}</span>
      </div>

      {/* Header Card */}
      <Card className={cn("border-l-4 mb-6", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                <MapPin className={cn("h-8 w-8", primaryTextClass)} />
                {district.cityName} {district.sport.toLowerCase().charAt(0).toUpperCase() + district.sport.toLowerCase().slice(1)}
              </h1>
              <p className="text-muted-foreground mt-1">
                {district.state}, {district.country}
              </p>
            </div>
            <Badge variant={district.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
              {district.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* View-Only Banner - Show only if user has a restriction */}
      {restrictionType && (
        <Alert className={cn(
          "mb-6",
          hasNoDistrict 
            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" 
            : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
        )}>
          {hasNoDistrict ? (
            <>
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">Add Your District</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Add your district in your profile to participate in Challenger Mode tournaments and challenges.
              </AlertDescription>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50"
                onClick={() => router.push(`/${sport}/profile`)}
              >
                Update Profile
              </Button>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">View Only Mode</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Challenger participation is limited to your home district. You can browse this district but cannot join tournaments or create challenges.
              </AlertDescription>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
                onClick={() => router.push(`/${sport}/dashboard/district/${userCityId}`)}
              >
                Go to My District
              </Button>
            </>
          )}
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border/50 rounded-lg p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Award className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Zap className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Trophy className="h-4 w-4 mr-2" />
            Tournaments
          </TabsTrigger>
          <TabsTrigger value="challenge" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Target className="h-4 w-4 mr-2" />
            Challenge Match
          </TabsTrigger>
        </TabsList>

        {/* Module 1: District Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Players</p>
                    <p className="text-2xl font-bold">{district.playerCount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Players</p>
                    <p className="text-2xl font-bold">{district.activePlayersCount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Trophy className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tournaments</p>
                    <p className="text-2xl font-bold">{district.tournamentCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                    <Gamepad2 className={cn("h-5 w-5", primaryTextClass)} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duel Matches</p>
                    <p className="text-2xl font-bold">{district.duelMatchCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Access */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Players Preview */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Award className={cn("h-5 w-5", primaryTextClass)} />
                    Top Players
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('leaderboard')}>
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No players yet</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((player) => (
                      <Link key={player.userId} href={`/${sport}/players/${player.userId}`}>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                              player.rank === 1 ? 'bg-yellow-500/10 text-yellow-600' :
                              player.rank === 2 ? 'bg-gray-500/10 text-gray-600' :
                              player.rank === 3 ? 'bg-orange-500/10 text-orange-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {player.rank}
                            </span>
                            <span className="font-medium">{player.playerName}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{player.playerRating}</p>
                            <p className="text-xs text-muted-foreground">{player.wins}W - {player.losses}L</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Tournaments Preview */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    Upcoming Events
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('tournaments')}>
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tournaments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No upcoming tournaments</p>
                ) : (
                  <div className="space-y-2">
                    {tournaments.slice(0, 3).map((t) => (
                      <Link key={t.id} href={`/${sport}/tournaments/${t.id}`}>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(t.startDate)}</p>
                          </div>
                          <Badge variant={t.isRegistrationOpen ? 'default' : 'secondary'}>
                            {t.participants}/{t.maxPlayers}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Active Challenge Matches */}
          {challengeMatches.length > 0 && (
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-500" />
                  Active Challenge Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {challengeMatches.slice(0, 2).map((match) => (
                    <div key={match.id} className="p-4 border border-border/50 rounded-lg">
                      <h4 className="font-medium">{match.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{match.venueName}</p>
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{match.joinedCount}/{match.minPlayers} players</span>
                          <span>{match.progress}%</span>
                        </div>
                        <Progress value={match.progress} className="h-2" />
                      </div>
                      <Button size="sm" className="mt-3 w-full" onClick={() => setActiveTab('challenge')}>
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Module 2: District Leaderboard */}
        <TabsContent value="leaderboard" className="space-y-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className={cn("h-5 w-5", primaryTextClass)} />
                    {district.cityName} {sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase()} Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-8">
                      <Award className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">No players on the leaderboard yet</p>
                      <p className="text-sm text-muted-foreground/70">Be the first to register and play!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left p-3 font-medium text-muted-foreground">Rank</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Player</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Rating</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Matches</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">W-L</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Win %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((player) => (
                            <tr key={player.userId} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="p-3">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  player.rank === 1 ? 'bg-yellow-500/10 text-yellow-600' :
                                  player.rank === 2 ? 'bg-gray-500/10 text-gray-600' :
                                  player.rank === 3 ? 'bg-orange-500/10 text-orange-600' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {player.rank}
                                </span>
                              </td>
                              <td className="p-3">
                                <Link href={`/${sport}/players/${player.userId}`} className="font-medium hover:text-primary">
                                  {player.playerName}
                                </Link>
                              </td>
                              <td className="p-3 text-center font-semibold">{player.playerRating}</td>
                              <td className="p-3 text-center text-muted-foreground">{player.matchesPlayed}</td>
                              <td className="p-3 text-center">
                                <span className="text-green-500">{player.wins}</span>
                                <span className="text-muted-foreground/50 mx-1">-</span>
                                <span className="text-red-500">{player.losses}</span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={player.winPercentage >= 60 ? 'default' : 'secondary'}>
                                  {player.winPercentage}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Module 3: Duel Activity Feed */}
            <TabsContent value="activity" className="space-y-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Recent Activity in {district.cityName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {feed.length === 0 ? (
                    <div className="text-center py-8">
                      <Zap className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">No recent activity</p>
                      <p className="text-sm text-muted-foreground/70">Activity will appear here as matches are played</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feed.map((item) => {
                        const style = getActivityStyle(item.activityType);
                        const Icon = style.icon;
                        return (
                          <div key={item.id} className={`flex gap-4 p-4 rounded-lg ${style.bg}`}>
                            <div className={`p-2 rounded-full ${style.bg}`}>
                              <Icon className={`h-5 w-5 ${style.color}`} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{item.title}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground/70 mt-2">
                                {formatRelativeTime(item.activityAt)}
                              </p>
                            </div>
                            {item.isFeatured && (
                              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700">
                                Featured
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Module 4: Upcoming Tournaments */}
            <TabsContent value="tournaments" className="space-y-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-purple-500" />
                    Tournaments in {district.cityName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tournaments.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">No upcoming tournaments</p>
                      <p className="text-sm text-muted-foreground/70">Check back later or create a challenge match</p>
                      <Button className="mt-4" onClick={() => setActiveTab('challenge')}>
                        Create Challenge Match
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tournaments.map((t) => (
                        <Link key={t.id} href={`/${sport}/tournaments/${t.id}`}>
                          <Card className="hover:shadow-md transition-shadow bg-card">
                            <CardContent className="p-4">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                  <h3 className="font-semibold text-lg">{t.name}</h3>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline">{t.type}</Badge>
                                    <Badge variant="outline">{t.scope}</Badge>
                                    {/* Centralized Status Badge */}
                                    <TournamentStatusBadge
                                      startDate={t.startDate}
                                      endDate={t.endDate}
                                      dbStatus={t.status}
                                      size="sm"
                                    />
                                  </div>
                                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {formatDate(t.startDate)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-4 w-4" />
                                      {t.location}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {t.prizePool && (
                                    <p className="text-lg font-semibold text-green-500">
                                      {formatCurrency(t.prizePool)} Prize
                                    </p>
                                  )}
                                  <p className="text-sm text-muted-foreground">
                                    Entry: {t.entryFee > 0 ? formatCurrency(t.entryFee) : 'Free'}
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {t.participants}/{t.maxPlayers} registered
                                  </p>
                                  <p className="text-xs text-muted-foreground/70 mt-1">
                                    by {t.organizer}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Module 5: Challenge Match */}
            <TabsContent value="challenge" className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-teal-500" />
                    Challenge Matches
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Create or join crowd-funded matches. Once enough players join, everyone pays to confirm.
                  </p>
                </div>
                
                {/* Create Challenge Match Button */}
                {authLoading ? (
                  <Button disabled className={cn("text-white", primaryBtnClass)}>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </Button>
                ) : userId ? (
                  <Button 
                    onClick={() => setShowCreateModal(true)}
                    className={cn("text-white", primaryBtnClass)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Challenge Match
                  </Button>
                ) : (
                  <Button asChild className={cn("text-white", primaryBtnClass)}>
                    <Link href={`/${sport}/login`}>
                      <Lock className="h-4 w-4 mr-2" />
                      Login to Create
                    </Link>
                  </Button>
                )}
              </div>

              {/* Active Challenge Matches - Full Width */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-teal-500" />
                  Active Challenges
                  {challengeMatches.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{challengeMatches.length}</Badge>
                  )}
                </h3>
                
                {challengeMatches.length === 0 ? (
                  <Card className="border-2 border-dashed">
                    <CardContent className="py-12 text-center">
                      <Target className={cn("h-16 w-16 mx-auto mb-4", primaryTextClass)} />
                      <h3 className="text-lg font-medium mb-2">No Active Challenges</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Be the first to create a challenge match in {district.cityName}!
                      </p>
                      {authLoading ? (
                        <Button disabled className={cn("text-white", primaryBtnClass)}>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </Button>
                      ) : userId ? (
                        <Button 
                          onClick={() => setShowCreateModal(true)}
                          className={cn("text-white", primaryBtnClass)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Challenge Match
                        </Button>
                      ) : (
                        <Button asChild className={cn("text-white", primaryBtnClass)}>
                          <Link href={`/${sport}/login`}>
                            <Lock className="h-4 w-4 mr-2" />
                            Login to Create
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {challengeMatches.map((match) => (
                      <ChallengeMatchCard
                        key={match.id}
                        match={match}
                        userId={userId || undefined}
                        currentSport={sport}
                        hasJoined={joinedMatches.has(match.id)}
                        hasPaid={paidMatches.has(match.id)}
                        onJoin={async (matchId) => {
                          if (!userId) return;
                          try {
                            const res = await fetch(`/api/challenge-match/${matchId}/join`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setJoinedMatches(prev => new Set(prev).add(matchId));
                              // Refresh matches
                              const refreshRes = await fetch(`/api/challenge-match?cityId=${districtId}&sport=${sport.toUpperCase()}&limit=10`);
                              const refreshData = await refreshRes.json();
                              if (refreshData.success) {
                                setChallengeMatches(refreshData.data.matches);
                              }
                            }
                          } catch (err) {
                            console.error('Error joining match:', err);
                          }
                        }}
                        onPay={(matchId) => {
                          // TODO: Integrate with payment gateway
                          console.log('Pay for match:', matchId);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* How it works */}
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">How Challenge Matches Work</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-4 gap-4">
                    <div className="text-center p-4">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold", primaryBgClass, primaryTextClass)}>1</div>
                      <h4 className="font-medium text-sm">Create</h4>
                      <p className="text-xs text-muted-foreground mt-1">Set date, venue, and min players</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-2 text-lg font-bold">2</div>
                      <h4 className="font-medium text-sm">Join</h4>
                      <p className="text-xs text-muted-foreground mt-1">Players join for free</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto mb-2 text-lg font-bold">3</div>
                      <h4 className="font-medium text-sm">Pay</h4>
                      <p className="text-xs text-muted-foreground mt-1">Once threshold reached, pay entry fee</p>
                    </div>
                    <div className="text-center p-4">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-2 text-lg font-bold">4</div>
                      <h4 className="font-medium text-sm">Play!</h4>
                      <p className="text-xs text-muted-foreground mt-1">Match confirmed, compete for prizes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Create Challenge Match Modal */}
          {district && userId && (
            <CreateChallengeMatchModal
              open={showCreateModal}
              onOpenChange={setShowCreateModal}
              cityId={district.cityId}
              cityName={district.cityName}
              stateName={district.state}
              sport={sport.toUpperCase()}
              userId={userId}
              isCornhole={isCornhole}
              onSuccess={async () => {
                // Refresh matches
                const res = await fetch(`/api/challenge-match?cityId=${districtId}&sport=${sport.toUpperCase()}&limit=10`);
                const data = await res.json();
                if (data.success) {
                  setChallengeMatches(data.data.matches);
                }
              }}
            />
          )}
    </div>
  );
}
