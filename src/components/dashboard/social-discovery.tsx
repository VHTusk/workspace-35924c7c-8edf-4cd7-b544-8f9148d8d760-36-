"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Play, 
  Eye, 
  UserPlus, 
  Trophy,
  Clock,
  MapPin,
  Zap,
  Loader2,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FriendPlaying {
  id: string;
  userId: string;
  status: string;
  tournamentName: string | null;
  lookingForTeam: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  isLive?: boolean;
}

interface LiveMatch {
  id: string;
  tournamentId: string;
  tournamentName: string | null;
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  yourFriend: { id: string; firstName: string; lastName: string };
  isLive: boolean;
}

interface FriendsActivityData {
  friendsPlaying: FriendPlaying[];
  friendsAvailable: FriendPlaying[];
  friendsLookingForTeam: FriendPlaying[];
  liveMatches: LiveMatch[];
  summary: {
    totalActive: number;
    playing: number;
    available: number;
    lookingForTeam: number;
  };
}

interface SocialDiscoveryProps {
  sport?: "cornhole" | "darts";
  onJoinTeam?: (requestId: string) => void;
}

export function SocialDiscovery({ 
  sport = "cornhole",
  onJoinTeam 
}: SocialDiscoveryProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FriendsActivityData | null>(null);
  const [joiningTeam, setJoiningTeam] = useState<string | null>(null);

  const primaryColor = sport === "cornhole" ? "text-green-500" : "text-teal-500";
  const primaryBg = sport === "cornhole" ? "bg-green-500/10" : "bg-teal-500/10";

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/player/friends-activity');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch friends activity:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleJoinTeam = async (requestId: string) => {
    if (!onJoinTeam) return;
    
    setJoiningTeam(requestId);
    try {
      await onJoinTeam(requestId);
    } finally {
      setJoiningTeam(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5" />
            Friends Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.summary.totalActive === 0) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5" />
            Friends Activity
          </CardTitle>
          <CardDescription>Follow other players to see their activity</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Start following players to see when they're playing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5" />
            Friends Activity
            <Badge className={cn(primaryBg, primaryColor, "border-transparent")}>
              {data.summary.totalActive} active
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {/* Live Matches */}
            {data.liveMatches.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Play className="w-3 h-3 text-red-500 animate-pulse" />
                  Live Now
                </h4>
                {data.liveMatches.map((match) => (
                  <div 
                    key={match.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {match.playerA.firstName} vs {match.playerB.firstName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.tournamentName || 'Tournament'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-red-500/30 text-red-500">
                      Your friend: {match.yourFriend.firstName}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Friends Playing */}
            {data.friendsPlaying.filter(f => !data.liveMatches.some(m => m.playerA.id === f.userId || m.playerB.id === f.userId)).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  In Tournament
                </h4>
                {data.friendsPlaying
                  .filter(f => !data.liveMatches.some(m => m.playerA.id === f.userId || m.playerB.id === f.userId))
                  .slice(0, 5)
                  .map((friend) => (
                    <div 
                      key={friend.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>
                            {friend.user.firstName[0]}{friend.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {friend.user.firstName} {friend.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {friend.tournamentName || 'Playing'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Friends Looking for Team */}
            {data.friendsLookingForTeam.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />
                  Looking for Partner
                </h4>
                {data.friendsLookingForTeam.slice(0, 3).map((friend) => (
                  <div 
                    key={friend.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>
                          {friend.user.firstName[0]}{friend.user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {friend.user.firstName} {friend.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Looking for doubles partner
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                      onClick={() => handleJoinTeam(friend.id)}
                      disabled={joiningTeam === friend.id}
                    >
                      {joiningTeam === friend.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-3 h-3 mr-1" />
                          Join
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Friends Available */}
            {data.friendsAvailable.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Available to Play
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.friendsAvailable.slice(0, 6).map((friend) => (
                    <Badge 
                      key={friend.id}
                      variant="outline"
                      className="px-3 py-1.5 cursor-pointer hover:bg-muted"
                    >
                      {friend.user.firstName} {friend.user.lastName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
