"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Trophy, Medal, Search, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  photoUrl?: string;
  points: number;
  elo: number;
  tier: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
  city?: string;
  state?: string;
  isCurrentUser?: boolean;
}

const tierColors: Record<string, string> = {
  UNRANKED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  BRONZE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  SILVER: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  GOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PLATINUM: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  DIAMOND: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function DashboardLeaderboardPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    fetchLeaderboard();
  }, [sport]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/leaderboard?sport=${sport.toUpperCase()}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setEntries(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry =>
    entry.playerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center"><Crown className="w-5 h-5 text-yellow-900" /></div>;
    if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center"><Medal className="w-5 h-5 text-gray-700" /></div>;
    if (rank === 3) return <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center"><Medal className="w-5 h-5 text-amber-100" /></div>;
    return <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">{rank}</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">Top {isCornhole ? "Cornhole" : "Darts"} players</p>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {entries.slice(0, 3).map((entry, index) => (
          <Card key={entry.playerId} className={cn(
            "relative overflow-hidden",
            index === 0 && "border-yellow-400 dark:border-yellow-600",
            entry.isCurrentUser && primaryBgClass
          )}>
            {index === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-400" />}
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                {getRankBadge(entry.rank)}
              </div>
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarFallback className={cn("text-lg font-bold", index === 0 ? "bg-yellow-100 text-yellow-700" : "bg-muted")}>
                  {entry.playerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">{entry.playerName}</h3>
              <p className="text-sm text-muted-foreground">{entry.city}, {entry.state}</p>
              <Badge className={cn("mt-2", tierColors[entry.tier])}>{entry.tier}</Badge>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold">{entry.points}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{entry.elo}</p>
                  <p className="text-xs text-muted-foreground">ELO</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredEntries.slice(3).map((entry) => (
              <div
                key={entry.playerId}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border",
                  entry.isCurrentUser && cn(primaryBgClass, "border-primary/50")
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 text-center font-bold text-muted-foreground">#{entry.rank}</div>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-muted">
                      {entry.playerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{entry.playerName}</p>
                    <p className="text-sm text-muted-foreground">{entry.city}, {entry.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <Badge className={tierColors[entry.tier]}>{entry.tier}</Badge>
                  <div className="text-right">
                    <p className="font-bold">{entry.points} pts</p>
                    <p className="text-xs text-muted-foreground">{entry.wins}W - {entry.losses}L</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
