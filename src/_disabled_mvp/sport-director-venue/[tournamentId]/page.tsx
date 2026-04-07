'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Trophy,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  UserCheck,
  ArrowRight,
  UserX,
  Save,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Types
interface TournamentInfo {
  id: string;
  name: string;
  status: string;
  sport: string;
}

interface Court {
  id: string;
  name: string;
  code: string | null;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  courtType: string | null;
  currentMatchId: string | null;
  currentMatch?: {
    id: string;
    playerA: { firstName: string; lastName: string };
    playerB: { firstName: string; lastName: string };
  };
}

interface QueueMatch {
  id: string;
  position: number;
  readiness: string;
  status: string;
  match: {
    id: string;
    playerA: { id: string; firstName: string; lastName: string };
    playerB: { id: string; firstName: string; lastName: string } | null;
  };
  readyAt: string | null;
}

interface PendingNoShow {
  id: string;
  matchId: string;
  player: { id: string; firstName: string; lastName: string };
  detectedAt: string;
  match: {
    id: string;
    playerA: { id: string; firstName: string; lastName: string };
    playerB: { id: string; firstName: string; lastName: string } | null;
  };
}

interface VenueData {
  config: unknown;
  courts: {
    total: number;
    available: number;
    occupied: number;
    list: Court[];
  };
  matchQueue: QueueMatch[];
  pendingNoShows: PendingNoShow[];
  healthAlerts: unknown[];
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  checkedIn: boolean;
}

export default function VenueOperationsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.tournamentId as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  // State
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Dialogs
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [assignCourtDialogOpen, setAssignCourtDialogOpen] = useState(false);
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<QueueMatch | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedNoShow, setSelectedNoShow] = useState<PendingNoShow | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Offline cache
  const [offlineMode, setOfflineMode] = useState(false);
  const [cachedData, setCachedData] = useState<VenueData | null>(null);

  // Theme classes
  const primaryTextClass = theme === 'green' ? 'text-green-600' : 'text-teal-600';
  const primaryBgClass = theme === 'green' ? 'bg-green-50' : 'bg-teal-50';
  const primaryBtnClass = theme === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-teal-600 hover:bg-teal-700';
  const primaryBorderClass = theme === 'green' ? 'border-green-200' : 'border-teal-200';

  // Fetch venue data
  const fetchVenueData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) setRefreshing(true);
    
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/venue-flow`);
      
      if (!navigator.onLine) {
        setOfflineMode(true);
        if (cachedData) {
          setVenueData(cachedData);
        }
        return;
      }

      if (res.status === 401) {
        router.push(`/${sport}/login`);
        return;
      }
      
      if (res.status === 403) {
        setError('Not authorized as tournament director');
        return;
      }

      if (!res.ok) throw new Error('Failed to load venue data');

      const data = await res.json();
      setVenueData(data);
      setCachedData(data);
      setOfflineMode(false);
      
      // Cache to localStorage for offline
      localStorage.setItem(`venue_${tournamentId}`, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to fetch venue data:', err);
      
      // Try to load from cache
      const cached = localStorage.getItem(`venue_${tournamentId}`);
      if (cached) {
        setVenueData(JSON.parse(cached));
        setOfflineMode(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId, sport, router, cachedData]);

  // Fetch tournament info
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        if (res.ok) {
          const data = await res.json();
          setTournament(data.tournament);
        }
      } catch (err) {
        console.error('Failed to fetch tournament:', err);
      }
    };

    fetchTournament();
    fetchVenueData();
  }, [tournamentId, fetchVenueData]);

  // WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '/';
    const newSocket = io(wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join-tournament', tournamentId);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('venue-update', (data: VenueData) => {
      setVenueData(data);
      localStorage.setItem(`venue_${tournamentId}`, JSON.stringify(data));
    });

    newSocket.on('court-status-change', (data: { courtId: string; status: string }) => {
      setVenueData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          courts: {
            ...prev.courts,
            list: prev.courts.list.map(c => 
              c.id === data.courtId ? { ...c, status: data.status as Court['status'] } : c
            ),
          },
        };
      });
    });

    newSocket.on('match-queue-update', (data: QueueMatch[]) => {
      setVenueData(prev => {
        if (!prev) return prev;
        return { ...prev, matchQueue: data };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-tournament', tournamentId);
      newSocket.disconnect();
    };
  }, [tournamentId]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (navigator.onLine) {
        fetchVenueData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchVenueData]);

  // Player search
  useEffect(() => {
    if (searchQuery.length > 0) {
      const fetchPlayers = async () => {
        try {
          const res = await fetch(`/api/director/tournament/${tournamentId}/checkins`);
          if (res.ok) {
            const data = await res.json();
            setPlayers(data.players || []);
          }
        } catch (err) {
          console.error('Failed to fetch players:', err);
        }
      };
      fetchPlayers();
    }
  }, [searchQuery, tournamentId]);

  useEffect(() => {
    if (searchQuery.length > 0 && players.length > 0) {
      const query = searchQuery.toLowerCase();
      setFilteredPlayers(
        players.filter(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(query)
        ).slice(0, 10)
      );
    } else {
      setFilteredPlayers([]);
    }
  }, [searchQuery, players]);

  // Actions
  const handleCheckIn = async (playerId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/director/tournament/${tournamentId}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: playerId, method: 'DIRECTOR' }),
      });

      if (res.ok) {
        toast.success('Player checked in successfully');
        setSearchQuery('');
        setCheckInDialogOpen(false);
        fetchVenueData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to check in player');
      }
    } catch (err) {
      toast.error('Failed to check in player');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignCourt = async () => {
    if (!selectedMatch || !selectedCourt) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/venue-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassign_court',
          matchId: selectedMatch.match.id,
          courtId: selectedCourt.id,
          reason: 'Director manual assignment',
        }),
      });

      if (res.ok) {
        toast.success('Court assigned successfully');
        setAssignCourtDialogOpen(false);
        setSelectedMatch(null);
        setSelectedCourt(null);
        fetchVenueData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to assign court');
      }
    } catch (err) {
      toast.error('Failed to assign court');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmNoShow = async () => {
    if (!selectedNoShow) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/venue-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_no_show',
          matchId: selectedNoShow.matchId,
          playerId: selectedNoShow.player.id,
          reason: 'No-show confirmed by director',
        }),
      });

      if (res.ok) {
        toast.success('No-show confirmed');
        setNoShowDialogOpen(false);
        setSelectedNoShow(null);
        fetchVenueData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to confirm no-show');
      }
    } catch (err) {
      toast.error('Failed to confirm no-show');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScoreSubmit = async () => {
    if (!selectedMatch) return;

    const scoreAInt = parseInt(scoreA);
    const scoreBInt = parseInt(scoreB);

    if (isNaN(scoreAInt) || isNaN(scoreBInt)) {
      toast.error('Please enter valid scores');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/matches/${selectedMatch.match.id}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoreA: scoreAInt,
          scoreB: scoreBInt,
        }),
      });

      if (res.ok) {
        toast.success('Score submitted successfully');
        setScoreDialogOpen(false);
        setSelectedMatch(null);
        setScoreA('');
        setScoreB('');
        fetchVenueData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to submit score');
      }
    } catch (err) {
      toast.error('Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading venue operations...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={() => router.push(`/${sport}/director`)}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableCourts = venueData?.courts.list.filter(c => c.status === 'AVAILABLE') || [];
  const nextMatchCount = venueData?.matchQueue.filter(q => q.status === 'QUEUED').length || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-lg font-bold ${primaryTextClass} flex items-center gap-2`}>
                <MapPin className="h-5 w-5" />
                Venue Operations
              </h1>
              <p className="text-sm text-gray-500 truncate">
                {tournament?.name || 'Loading...'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {offlineMode && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
              <Badge variant={connected ? "default" : "secondary"} className="gap-1">
                {connected ? (
                  <>
                    <Wifi className="h-3 w-3" />
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    Offline
                  </>
                )}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchVenueData(true)}
                disabled={refreshing}
                className="h-10 w-10"
              >
                <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Tournament Overview Card */}
        <Card className={cn("border-l-4", primaryBorderClass)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className={`h-5 w-5 ${primaryTextClass}`} />
                <span className="font-medium">{tournament?.name}</span>
              </div>
              <Badge className={cn(
                tournament?.status === 'IN_PROGRESS' && 'bg-green-500',
                tournament?.status === 'REGISTRATION_OPEN' && 'bg-blue-500',
              )}>
                {tournament?.status?.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{nextMatchCount}</p>
                <p className="text-xs text-gray-500">In Queue</p>
              </div>
              <div className="text-center p-2 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{venueData?.courts.available || 0}</p>
                <p className="text-xs text-green-600">Available</p>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{venueData?.courts.occupied || 0}</p>
                <p className="text-xs text-orange-600">In Use</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending No-Shows Alert */}
        {venueData?.pendingNoShows && venueData.pendingNoShows.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <UserX className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-700">Pending No-Shows ({venueData.pendingNoShows.length})</span>
              </div>
              <div className="space-y-2">
                {venueData.pendingNoShows.slice(0, 3).map((noShow) => (
                  <div key={noShow.id} className="flex items-center justify-between bg-white p-2 rounded">
                    <div>
                      <p className="text-sm font-medium">{noShow.player.firstName} {noShow.player.lastName}</p>
                      <p className="text-xs text-gray-500">
                        vs {noShow.match.playerB?.firstName || 'TBD'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-10 min-w-[80px]"
                      onClick={() => {
                        setSelectedNoShow(noShow);
                        setNoShowDialogOpen(true);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Court Status Grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Courts
              </span>
              <span className="text-sm font-normal text-gray-500">
                {venueData?.courts.total || 0} total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {venueData?.courts.list.map((court) => (
                <button
                  key={court.id}
                  className={cn(
                    "p-3 rounded-lg border-2 text-center transition-all min-h-[80px] flex flex-col justify-center",
                    court.status === 'AVAILABLE' && "border-green-500 bg-green-50",
                    court.status === 'OCCUPIED' && "border-orange-500 bg-orange-50",
                    court.status === 'MAINTENANCE' && "border-gray-400 bg-gray-100"
                  )}
                  onClick={() => {
                    if (court.status === 'AVAILABLE' && venueData.matchQueue.length > 0) {
                      setSelectedMatch(venueData.matchQueue[0]);
                      setSelectedCourt(court);
                      setAssignCourtDialogOpen(true);
                    }
                  }}
                >
                  <p className="font-medium text-sm">{court.name}</p>
                  <Badge className={cn(
                    "mt-1 text-xs",
                    court.status === 'AVAILABLE' && "bg-green-500",
                    court.status === 'OCCUPIED' && "bg-orange-500",
                    court.status === 'MAINTENANCE' && "bg-gray-500"
                  )}>
                    {court.status}
                  </Badge>
                  {court.currentMatch && (
                    <p className="text-xs mt-1 truncate">
                      {court.currentMatch.playerA.firstName} vs {court.currentMatch.playerB.firstName}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Match Queue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Match Queue ({venueData?.matchQueue.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              {venueData?.matchQueue && venueData.matchQueue.length > 0 ? (
                venueData.matchQueue.map((queueItem, index) => (
                  <div
                    key={queueItem.id}
                    className={cn(
                      "flex items-center justify-between p-3 border-b last:border-b-0",
                      index === 0 && "bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg",
                        primaryBgClass
                      )}>
                        {queueItem.position}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {queueItem.match.playerA.firstName} {queueItem.match.playerA.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          vs {queueItem.match.playerB?.firstName || 'TBD'} {queueItem.match.playerB?.lastName || ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        queueItem.readiness === 'READY' && "bg-green-500",
                        queueItem.readiness === 'PARTIAL' && "bg-yellow-500",
                        queueItem.readiness === 'NOT_READY' && "bg-gray-400"
                      )}>
                        {queueItem.readiness}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        onClick={() => {
                          setSelectedMatch(queueItem);
                          setScoreDialogOpen(true);
                        }}
                      >
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No matches in queue</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Quick Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="grid grid-cols-4 gap-1 p-2 max-w-lg mx-auto">
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={() => setCheckInDialogOpen(true)}
          >
            <UserCheck className="h-5 w-5" />
            <span className="text-xs">Check-in</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={() => {
              if (venueData?.matchQueue && venueData.matchQueue.length > 0) {
                setSelectedMatch(venueData.matchQueue[0]);
                setAssignCourtDialogOpen(true);
              }
            }}
            disabled={!venueData?.matchQueue || venueData.matchQueue.length === 0}
          >
            <MapPin className="h-5 w-5" />
            <span className="text-xs">Assign</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => {
              if (venueData?.pendingNoShows && venueData.pendingNoShows.length > 0) {
                setSelectedNoShow(venueData.pendingNoShows[0]);
                setNoShowDialogOpen(true);
              } else {
                toast.info('No pending no-shows');
              }
            }}
          >
            <UserX className="h-5 w-5" />
            <span className="text-xs">No-Show</span>
          </Button>
          <Button
            variant="outline"
            className="h-16 flex-col gap-1"
            onClick={() => {
              if (venueData?.matchQueue && venueData.matchQueue.length > 0) {
                setSelectedMatch(venueData.matchQueue[0]);
                setScoreDialogOpen(true);
              }
            }}
            disabled={!venueData?.matchQueue || venueData.matchQueue.length === 0}
          >
            <PlayCircle className="h-5 w-5" />
            <span className="text-xs">Score</span>
          </Button>
        </div>
      </div>

      {/* Check-in Dialog */}
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Player Check-in
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border",
                    player.checkedIn ? "bg-green-50 border-green-200" : "bg-white hover:bg-gray-50"
                  )}
                  onClick={() => !player.checkedIn && handleCheckIn(player.id)}
                  disabled={player.checkedIn || submitting}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      player.checkedIn ? "bg-green-100" : primaryBgClass
                    )}>
                      {player.checkedIn ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <span className={primaryTextClass}>
                          {player.firstName[0]}{player.lastName[0]}
                        </span>
                      )}
                    </div>
                    <span className="font-medium">{player.firstName} {player.lastName}</span>
                  </div>
                  {player.checkedIn ? (
                    <Badge className="bg-green-500">Checked In</Badge>
                  ) : (
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              ))}
              {searchQuery && filteredPlayers.length === 0 && (
                <p className="text-center text-gray-500 py-4">No players found</p>
              )}
              {!searchQuery && (
                <p className="text-center text-gray-500 py-4">Type to search players</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Court Dialog */}
      <Dialog open={assignCourtDialogOpen} onOpenChange={setAssignCourtDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Assign Court
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedMatch && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">
                  {selectedMatch.match.playerA.firstName} {selectedMatch.match.playerA.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  vs {selectedMatch.match.playerB?.firstName || 'TBD'} {selectedMatch.match.playerB?.lastName || ''}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {availableCourts.map((court) => (
                <Button
                  key={court.id}
                  variant={selectedCourt?.id === court.id ? "default" : "outline"}
                  className={cn(
                    "h-16 flex-col gap-1",
                    selectedCourt?.id === court.id && primaryBtnClass
                  )}
                  onClick={() => setSelectedCourt(court)}
                >
                  <MapPin className="h-4 w-4" />
                  <span>{court.name}</span>
                </Button>
              ))}
            </div>
            {availableCourts.length === 0 && (
              <p className="text-center text-gray-500 py-4">No available courts</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignCourtDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignCourt}
              disabled={!selectedCourt || submitting}
              className={primaryBtnClass}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-Show Confirmation Dialog */}
      <Dialog open={noShowDialogOpen} onOpenChange={setNoShowDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <UserX className="h-5 w-5" />
              Confirm No-Show
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedNoShow && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="font-medium text-red-700">
                  {selectedNoShow.player.firstName} {selectedNoShow.player.lastName}
                </p>
                <p className="text-sm text-red-600 mt-1">
                  will be marked as no-show and forfeit the match
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Detected: {new Date(selectedNoShow.detectedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4">
              This action cannot be undone. The opponent will automatically advance.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoShowDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmNoShow}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm No-Show'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Score Entry Dialog */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Enter Match Score
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedMatch && (
              <div className="grid grid-cols-3 gap-4 items-center">
                {/* Player A */}
                <div className="text-center">
                  <p className="font-medium text-sm mb-2">
                    {selectedMatch.match.playerA.firstName}
                  </p>
                  <Input
                    type="number"
                    min="0"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    placeholder="0"
                    className="h-16 text-3xl text-center font-bold"
                  />
                </div>
                <div className="text-2xl font-bold text-gray-300 text-center">vs</div>
                {/* Player B */}
                <div className="text-center">
                  <p className="font-medium text-sm mb-2">
                    {selectedMatch.match.playerB?.firstName || 'TBD'}
                  </p>
                  <Input
                    type="number"
                    min="0"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    placeholder="0"
                    className="h-16 text-3xl text-center font-bold"
                    disabled={!selectedMatch.match.playerB}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScoreSubmit}
              disabled={submitting}
              className={primaryBtnClass}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Submit Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
