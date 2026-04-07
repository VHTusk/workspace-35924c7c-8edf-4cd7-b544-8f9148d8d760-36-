'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Activity,
  Users,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  CheckCircle2,
  Timer,
  Calendar,
  Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  useCourtStatus,
  getCourtStatusColor,
  getReadinessColor,
  type CourtLiveState,
  type QueueItem,
  type CourtLiveStatus,
} from '@/hooks/use-court-status';
import { toast } from 'sonner';

interface TournamentInfo {
  id: string;
  name: string;
  status: string;
  totalMatches: number;
  completedMatches: number;
  venue?: {
    name: string;
    address: string;
  };
}

export default function VenueCourtsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.tournamentId as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Get session info for WebSocket auth
  const [sessionInfo, setSessionInfo] = useState<{ token?: string; userId?: string; role?: string }>({});

  useEffect(() => {
    // Get session token from cookies
    const token = document.cookie
      .split(';')
      .find(c => c.trim().startsWith('session_token='))
      ?.split('=')[1];
    
    setSessionInfo({ token });
  }, []);

  // Connect to court status WebSocket
  const {
    courts,
    queue,
    connected,
    lastUpdate,
    error,
    refreshStatus,
  } = useCourtStatus(tournamentId, sessionInfo);

  // Fetch tournament info
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const res = await fetch(`/api/public/tournaments/${tournamentId}`);
        if (res.ok) {
          const data = await res.json();
          setTournament(data.tournament || data);
        }
      } catch (err) {
        console.error('Failed to fetch tournament:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [tournamentId]);

  // Court stats
  const courtStats = useMemo(() => {
    const available = courts.filter(c => c.status === 'AVAILABLE').length;
    const inProgress = courts.filter(c => c.status === 'IN_PROGRESS').length;
    const onBreak = courts.filter(c => c.status === 'BREAK').length;
    const maintenance = courts.filter(c => c.status === 'MAINTENANCE').length;
    
    return {
      total: courts.length,
      available,
      inProgress,
      onBreak,
      maintenance,
      activeMatches: courts.filter(c => c.currentMatch).length,
    };
  }, [courts]);

  // Queue stats
  const queueStats = useMemo(() => {
    const ready = queue.filter(q => q.readiness === 'READY').length;
    const partial = queue.filter(q => q.readiness === 'PARTIAL').length;
    const notReady = queue.filter(q => q.readiness === 'NOT_READY').length;
    
    return {
      total: queue.length,
      ready,
      partial,
      notReady,
    };
  }, [queue]);

  const primaryTextClass = theme === 'green' ? 'text-green-600' : 'text-teal-600';
  const primaryBgClass = theme === 'green' ? 'bg-green-50' : 'bg-teal-50';
  const primaryBtnClass = theme === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-teal-600 hover:bg-teal-700';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={cn("border-b", primaryBgClass)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <MapPin className="h-4 w-4" />
                {tournament?.venue?.name || 'Venue'}
              </div>
              <h1 className={cn("text-2xl font-bold", primaryTextClass)}>
                {tournament?.name || 'Tournament'} Courts
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  {tournament?.status?.replace(/_/g, ' ') || 'Live'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {tournament?.completedMatches || 0} / {tournament?.totalMatches || 0} matches
                </span>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                {connected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-red-600 font-medium">Disconnected</span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshStatus}
                disabled={!connected}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Error Alert */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{courtStats.total}</p>
                  <p className="text-sm text-gray-500">Total Courts</p>
                </div>
                <MapPin className="h-8 w-8 text-gray-300" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{courtStats.inProgress}</p>
                  <p className="text-sm text-gray-500">In Progress</p>
                </div>
                <Activity className="h-8 w-8 text-blue-300" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{courtStats.available}</p>
                  <p className="text-sm text-gray-500">Available</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-300" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{queueStats.total}</p>
                  <p className="text-sm text-gray-500">In Queue</p>
                </div>
                <Users className="h-8 w-8 text-amber-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courts Grid */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Courts ({courts.length})</CardTitle>
                  {lastUpdate && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Updated {formatTimeAgo(lastUpdate)}
                    </span>
                  )}
                </div>
                <CardDescription>
                  Real-time court status and current matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {courts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No courts configured</p>
                    <p className="text-sm mt-1">Courts will appear here when the tournament starts</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {courts.map((court) => (
                      <CourtCard key={court.courtId} court={court} theme={theme} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Match Queue */}
          <div>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Match Queue
                  </CardTitle>
                  {queueStats.ready > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      {queueStats.ready} Ready
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Upcoming matches waiting for courts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {queue.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                    <p>No matches in queue</p>
                    <p className="text-xs mt-1">All matches have been assigned</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-3">
                    <div className="space-y-3">
                      {queue.map((item, index) => (
                        <QueueItemCard 
                          key={item.matchId} 
                          item={item} 
                          position={index + 1}
                          theme={theme}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tournament Progress */}
        {tournament && tournament.totalMatches > 0 && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Tournament Progress</span>
                <span className="text-sm text-gray-500">
                  {tournament.completedMatches} of {tournament.totalMatches} matches
                </span>
              </div>
              <Progress 
                value={(tournament.completedMatches / tournament.totalMatches) * 100} 
                className="h-2"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Court Card Component
function CourtCard({ court, theme }: { court: CourtLiveState; theme: string }) {
  const statusColors: Record<CourtLiveStatus, string> = {
    AVAILABLE: 'border-emerald-300 bg-emerald-50',
    IN_PROGRESS: 'border-blue-400 bg-blue-50',
    BREAK: 'border-amber-300 bg-amber-50',
    MAINTENANCE: 'border-red-300 bg-red-50',
  };

  const statusIcons: Record<CourtLiveStatus, React.ReactNode> = {
    AVAILABLE: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    IN_PROGRESS: <Play className="h-4 w-4 text-blue-500" />,
    BREAK: <Pause className="h-4 w-4 text-amber-500" />,
    MAINTENANCE: <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  const primaryTextClass = theme === 'green' ? 'text-green-600' : 'text-teal-600';

  return (
    <div className={cn(
      "rounded-lg border-2 p-4 transition-all",
      statusColors[court.status]
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {court.courtName}
          </h3>
          <Badge className={cn("mt-1", getCourtStatusColor(court.status))}>
            {statusIcons[court.status]}
            <span className="ml-1">{court.status.replace(/_/g, ' ')}</span>
          </Badge>
        </div>
      </div>

      {court.currentMatch ? (
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              Round {court.currentMatch.round} - Match {court.currentMatch.matchNumber}
            </span>
            {court.currentMatch.startedAt && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Timer className="h-3 w-3" />
                {formatDuration(new Date(court.currentMatch.startedAt))}
              </span>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{court.currentMatch.playerA}</span>
              <span className={cn("font-bold text-lg", primaryTextClass)}>
                {court.currentMatch.scoreA ?? '-'}
              </span>
            </div>
            <div className="text-center text-xs text-gray-400">vs</div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{court.currentMatch.playerB}</span>
              <span className={cn("font-bold text-lg", primaryTextClass)}>
                {court.currentMatch.scoreB ?? '-'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          {court.status === 'AVAILABLE' ? (
            <>
              <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-400" />
              <p className="text-sm">Ready for next match</p>
            </>
          ) : court.status === 'BREAK' ? (
            <>
              <Pause className="h-6 w-6 mx-auto mb-1 text-amber-400" />
              <p className="text-sm">On break</p>
            </>
          ) : (
            <>
              <AlertCircle className="h-6 w-6 mx-auto mb-1 text-red-400" />
              <p className="text-sm">Under maintenance</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Queue Item Component
function QueueItemCard({ item, position, theme }: { item: QueueItem; position: number; theme: string }) {
  const primaryTextClass = theme === 'green' ? 'text-green-600' : 'text-teal-600';
  const primaryBgClass = theme === 'green' ? 'bg-green-50' : 'bg-teal-50';

  return (
    <div className={cn(
      "rounded-lg border p-3 transition-all",
      item.readiness === 'READY' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
            primaryBgClass, primaryTextClass
          )}>
            {position}
          </span>
          <span className="text-xs text-gray-500">
            Round {item.round} - Match {item.matchNumber}
          </span>
        </div>
        <Badge className={getReadinessColor(item.readiness)}>
          {item.readiness.replace(/_/g, ' ')}
        </Badge>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{item.playerA}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <ChevronRight className="h-3 w-3" />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{item.playerB}</span>
        </div>
      </div>

      {item.readyAt && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Ready since {formatTimeAgo(new Date(item.readyAt))}
        </div>
      )}
    </div>
  );
}

// Helper Functions
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(startDate: Date): string {
  const diffMs = Date.now() - startDate.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
