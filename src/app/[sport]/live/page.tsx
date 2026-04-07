'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Radio, 
  Trophy, 
  Clock, 
  MapPin, 
  Users, 
  RefreshCw,
  Play,
  Pause,
  ChevronRight,
  Activity
} from 'lucide-react';

interface LiveMatch {
  id: string;
  tournamentId: string;
  tournamentName: string;
  roundNumber: number;
  matchNumber: number;
  playerA: {
    id: string;
    name: string;
    tier: string;
    score: number;
  };
  playerB: {
    id: string;
    name: string;
    tier: string;
    score: number;
  };
  court?: string;
  scheduledTime?: string;
  status: 'LIVE' | 'PENDING' | 'COMPLETED' | 'PAUSED';
  sport: string;
  updatedAt: string;
}

interface TournamentTicker {
  id: string;
  name: string;
  status: string;
  liveMatches: number;
  completedMatches: number;
  totalMatches: number;
}

export default function LiveMatchTickerPage() {
  const params = useParams();
  const sport = params.sport as string;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [recentResults, setRecentResults] = useState<LiveMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<LiveMatch[]>([]);
  const [activeTournaments, setActiveTournaments] = useState<TournamentTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);

  // Fetch initial data
  const fetchLiveMatches = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/live?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setLiveMatches(data.live || []);
        setRecentResults(data.recent || []);
        setUpcomingMatches(data.upcoming || []);
        setActiveTournaments(data.tournaments || []);
      }
    } catch (error) {
      console.error('Failed to fetch live matches:', error);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '/';
    const newSocket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Live Ticker] Connected to WebSocket');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[Live Ticker] Disconnected from WebSocket');
      setConnected(false);
    });

    // Join live matches room
    newSocket.emit('join-live-ticker', { sport: sport.toUpperCase() });

    // Listen for match updates
    newSocket.on('match-update', (data: LiveMatch) => {
      setLiveMatches(prev => {
        const index = prev.findIndex(m => m.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [data, ...prev];
      });
    });

    // Listen for match completion
    newSocket.on('match-complete', (data: LiveMatch) => {
      setLiveMatches(prev => prev.filter(m => m.id !== data.id));
      setRecentResults(prev => [data, ...prev].slice(0, 20));
    });

    // Listen for new match starting
    newSocket.on('match-start', (data: LiveMatch) => {
      setLiveMatches(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [data, ...prev];
      });
      setUpcomingMatches(prev => prev.filter(m => m.id !== data.id));
    });

    // Listen for tournament updates
    newSocket.on('tournament-update', (data: TournamentTicker) => {
      setActiveTournaments(prev => {
        const index = prev.findIndex(t => t.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [data, ...prev];
      });
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchLiveMatches();

    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveMatches, 30000);

    return () => {
      newSocket.disconnect();
      clearInterval(interval);
    };
  }, [sport, fetchLiveMatches]);

  // Join tournament room when selected
  useEffect(() => {
    if (socket && selectedTournament) {
      socket.emit('join-tournament', selectedTournament);
      return () => {
        socket.emit('leave-tournament', selectedTournament);
      };
    }
  }, [socket, selectedTournament]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeSince = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'DIAMOND': 'bg-cyan-500',
      'PLATINUM': 'bg-emerald-500',
      'GOLD': 'bg-yellow-500',
      'SILVER': 'bg-gray-400',
      'BRONZE': 'bg-orange-600',
    };
    return colors[tier] || 'bg-gray-500';
  };

  const filteredLiveMatches = selectedTournament 
    ? liveMatches.filter(m => m.tournamentId === selectedTournament)
    : liveMatches;

  const filteredRecentResults = selectedTournament
    ? recentResults.filter(m => m.tournamentId === selectedTournament)
    : recentResults;

  const filteredUpcoming = selectedTournament
    ? upcomingMatches.filter(m => m.tournamentId === selectedTournament)
    : upcomingMatches;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Radio className="h-8 w-8 text-red-500" />
                {connected && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">Live Match Ticker</h1>
                <p className="text-sm text-muted-foreground">
                  Real-time updates from {sport.charAt(0).toUpperCase() + sport.slice(1)} tournaments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={connected ? "default" : "secondary"} className="gap-1">
                {connected ? (
                  <>
                    <Activity className="h-3 w-3" />
                    Live
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" />
                    Disconnected
                  </>
                )}
              </Badge>
              <Button variant="outline" size="icon" onClick={fetchLiveMatches}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Active Tournaments */}
        {activeTournaments.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Active Tournaments
            </h2>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 pb-2">
                <Button
                  variant={selectedTournament === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTournament(null)}
                >
                  All Tournaments
                </Button>
                {activeTournaments.map(tournament => (
                  <Button
                    key={tournament.id}
                    variant={selectedTournament === tournament.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTournament(tournament.id)}
                    className="gap-2"
                  >
                    {tournament.name}
                    <Badge variant="secondary" className="ml-1">
                      {tournament.liveMatches} live
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
                  <Radio className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{liveMatches.length}</p>
                  <p className="text-xs text-muted-foreground">Live Now</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 rounded-lg dark:bg-yellow-900/30">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingMatches.length}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
                  <Trophy className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recentResults.length}</p>
                  <p className="text-xs text-muted-foreground">Completed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeTournaments.length}</p>
                  <p className="text-xs text-muted-foreground">Active Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="live" className="space-y-4">
          <TabsList>
            <TabsTrigger value="live" className="gap-2">
              <Radio className="h-4 w-4" />
              Live ({filteredLiveMatches.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <Clock className="h-4 w-4" />
              Upcoming ({filteredUpcoming.length})
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2">
              <Trophy className="h-4 w-4" />
              Recent Results
            </TabsTrigger>
          </TabsList>

          {/* Live Matches */}
          <TabsContent value="live" className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLiveMatches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Live Matches</h3>
                  <p className="text-muted-foreground">
                    Check back soon for live match updates
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredLiveMatches.map(match => (
                  <Card key={match.id} className="overflow-hidden border-l-4 border-l-red-500">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">
                          {match.tournamentName}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {match.court && (
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {match.court}
                            </Badge>
                          )}
                          <Badge className="bg-red-500 animate-pulse">
                            <Play className="h-3 w-3 mr-1" />
                            LIVE
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Round {match.roundNumber} • Match {match.matchNumber}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        {/* Player A */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${getTierColor(match.playerA.tier)} text-white text-xs`}>
                              {match.playerA.tier}
                            </Badge>
                            <span className="font-medium">{match.playerA.name}</span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-4 px-6">
                          <span className="text-3xl font-bold">{match.playerA.score}</span>
                          <span className="text-xl text-muted-foreground">-</span>
                          <span className="text-3xl font-bold">{match.playerB.score}</span>
                        </div>

                        {/* Player B */}
                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <span className="font-medium">{match.playerB.name}</span>
                            <Badge className={`${getTierColor(match.playerB.tier)} text-white text-xs`}>
                              {match.playerB.tier}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                        <span>Updated {getTimeSince(match.updatedAt)}</span>
                        <Button variant="ghost" size="sm" className="gap-1">
                          View Details
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upcoming Matches */}
          <TabsContent value="upcoming" className="space-y-4">
            {filteredUpcoming.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Upcoming Matches</h3>
                  <p className="text-muted-foreground">
                    All scheduled matches have started or completed
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredUpcoming.map(match => (
                  <Card key={match.id} className="hover:bg-accent/50 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {match.playerA.name} vs {match.playerB.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {match.tournamentName} • Round {match.roundNumber}
                          </p>
                        </div>
                        <div className="text-right">
                          {match.scheduledTime && (
                            <p className="font-medium">{formatTime(match.scheduledTime)}</p>
                          )}
                          {match.court && (
                            <p className="text-sm text-muted-foreground">{match.court}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Recent Results */}
          <TabsContent value="results" className="space-y-4">
            {filteredRecentResults.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Recent Results</h3>
                  <p className="text-muted-foreground">
                    Completed matches will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredRecentResults.map(match => {
                  const winner = match.playerA.score > match.playerB.score 
                    ? match.playerA 
                    : match.playerB;
                  
                  return (
                    <Card key={match.id} className="overflow-hidden relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                      <CardContent className="py-4 pl-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-medium ${match.playerA.score > match.playerB.score ? 'text-green-600' : ''}`}>
                                {match.playerA.name}
                              </span>
                              <span className="text-lg font-bold">
                                {match.playerA.score} - {match.playerB.score}
                              </span>
                              <span className={`font-medium ${match.playerB.score > match.playerA.score ? 'text-green-600' : ''}`}>
                                {match.playerB.name}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {match.tournamentName} • Round {match.roundNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary">
                              <Trophy className="h-3 w-3 mr-1" />
                              {winner.name}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {getTimeSince(match.updatedAt)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
