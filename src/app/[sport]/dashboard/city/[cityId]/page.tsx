'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Users, Trophy, Gamepad2, Calendar, TrendingUp,
  ChevronRight, Target, Zap, Award, CheckCircle,
  AlertCircle, ArrowRight, Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SportType } from '@prisma/client';
import { cn } from '@/lib/utils';

// Types
interface CityData {
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

export default function CityPage() {
  const params = useParams();
  const cityId = params.cityId as string;
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [city, setCity] = useState<CityData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [polls, setPolls] = useState<InterestPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch all city data
  useEffect(() => {
    const fetchCityData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all modules in parallel
        const [overviewRes, leaderboardRes, feedRes, tournamentsRes, pollsRes] = await Promise.all([
          fetch(`/api/city/${cityId}`),
          fetch(`/api/city/${cityId}/leaderboard?limit=10`),
          fetch(`/api/city/${cityId}/feed?limit=10`),
          fetch(`/api/city/${cityId}/tournaments?limit=5`),
          fetch(`/api/city/${cityId}/interest?limit=5`),
        ]);

        if (!overviewRes.ok) {
          throw new Error('City not found');
        }

        const overviewData = await overviewRes.json();
        const leaderboardData = await leaderboardRes.json();
        const feedData = await feedRes.json();
        const tournamentsData = await tournamentsRes.json();
        const pollsData = await pollsRes.json();

        setCity(overviewData.data);
        setLeaderboard(leaderboardData.data?.leaderboard || []);
        setFeed(feedData.data?.feed || []);
        setTournaments(tournamentsData.data?.tournaments || []);
        setPolls(pollsData.data?.polls || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load city data');
      } finally {
        setLoading(false);
      }
    };

    if (cityId) {
      fetchCityData();
    }
  }, [cityId]);

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !city) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">City Not Found</h2>
            <p className="text-muted-foreground mb-4">{error || 'The requested city page does not exist.'}</p>
            <Link href={`/${sport}/dashboard/cities`}>
              <Button>Back to Cities</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Link href={`/${sport}/dashboard`} className="hover:text-foreground">Dashboard</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/${sport}/dashboard/cities`} className="hover:text-foreground">Cities</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{city.cityName}</span>
          </div>

          {/* Header Card */}
          <Card className={cn("border-l-4 mb-6", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                    <MapPin className={cn("h-8 w-8", primaryTextClass)} />
                    {city.cityName} {city.sport.toLowerCase().charAt(0).toUpperCase() + city.sport.toLowerCase().slice(1)}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {city.state}, {city.country}
                  </p>
                </div>
                <Badge variant={city.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                  {city.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

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
              <TabsTrigger value="demand" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Target className="h-4 w-4 mr-2" />
                Demand
              </TabsTrigger>
            </TabsList>

            {/* Module 1: City Overview */}
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
                        <p className="text-2xl font-bold">{city.playerCount.toLocaleString()}</p>
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
                        <p className="text-2xl font-bold">{city.activePlayersCount.toLocaleString()}</p>
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
                        <p className="text-2xl font-bold">{city.tournamentCount}</p>
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
                        <p className="text-2xl font-bold">{city.duelMatchCount}</p>
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

              {/* Active Interest Polls */}
              {polls.length > 0 && (
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-500" />
                      Active Demand Polls
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {polls.slice(0, 2).map((poll) => (
                        <div key={poll.id} className="p-4 border border-border/50 rounded-lg">
                          <h4 className="font-medium">{poll.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{poll.description}</p>
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span>{poll.interestedCount}/{poll.minPlayers} players</span>
                              <span>{poll.progress}%</span>
                            </div>
                            <Progress value={poll.progress} className="h-2" />
                          </div>
                          <Button size="sm" className="mt-3 w-full" onClick={() => setActiveTab('demand')}>
                            Express Interest
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Module 2: City Leaderboard */}
            <TabsContent value="leaderboard" className="space-y-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className={cn("h-5 w-5", primaryTextClass)} />
                    {city.cityName} {sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase()} Leaderboard
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
                    Recent Activity in {city.cityName}
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
                    Tournaments in {city.cityName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tournaments.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">No upcoming tournaments</p>
                      <p className="text-sm text-muted-foreground/70">Check back later or create a demand poll</p>
                      <Button className="mt-4" onClick={() => setActiveTab('demand')}>
                        Create Demand Poll
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
                                    <Badge variant={t.isRegistrationOpen ? 'default' : 'secondary'}>
                                      {t.status}
                                    </Badge>
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

            {/* Module 5: Interest Polls (Demand Generation) */}
            <TabsContent value="demand" className="space-y-6">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Demand Polls - Request Tournaments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-6">
                    Express interest in tournament types you want to see in {city.cityName}. Once enough players show interest, organizers will create the tournament!
                  </p>

                  {polls.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border/50 rounded-lg">
                      <Target className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">No active demand polls</p>
                      <p className="text-sm text-muted-foreground/70 mb-4">Be the first to request a tournament!</p>
                      <Button>Create Demand Poll</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {polls.map((poll) => (
                        <Card key={poll.id} className="bg-card">
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{poll.title}</h3>
                                {poll.description && (
                                  <p className="text-muted-foreground mt-1">{poll.description}</p>
                                )}
                                {poll.proposedDate && (
                                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Proposed: {formatDate(poll.proposedDate)}
                                  </p>
                                )}
                                <div className="mt-4">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium">
                                      {poll.interestedCount} / {poll.minPlayers} players needed
                                    </span>
                                    <span className="font-semibold text-green-500">{poll.progress}%</span>
                                  </div>
                                  <Progress value={poll.progress} className="h-3" />
                                  <p className="text-xs text-muted-foreground/70 mt-1">
                                    Expires: {formatDate(poll.expiresAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button className="bg-green-500 hover:bg-green-600">
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  I&apos;m Interested
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                  {poll.remainingPlayers} more needed
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
    </div>
  );
}
