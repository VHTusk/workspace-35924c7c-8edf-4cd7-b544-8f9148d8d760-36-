"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Medal, 
  Star, 
  Share2, 
  Pin,
  ExternalLink,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Trophy {
  id: string;
  title: string;
  description: string | null;
  trophyType: string;
  position: number | null;
  isFeatured: boolean;
  shareCount: number;
  earnedAt: string;
  tournamentId: string | null;
}

interface TrophyStats {
  total: number;
  gold: number;
  silver: number;
  bronze: number;
  featured: number;
}

interface TrophyCabinetProps {
  sport?: "cornhole" | "darts";
  userId?: string;
  compact?: boolean;
}

export function TrophyCabinet({ 
  sport = "cornhole",
  userId,
  compact = false
}: TrophyCabinetProps) {
  const [loading, setLoading] = useState(true);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [stats, setStats] = useState<TrophyStats | null>(null);

  const primaryColor = sport === "cornhole" ? "text-green-500" : "text-teal-500";
  const primaryBg = sport === "cornhole" ? "bg-green-500/10" : "bg-teal-500/10";

  const fetchTrophies = async () => {
    setLoading(true);
    try {
      const url = userId 
        ? `/api/player/trophies?userId=${userId}`
        : '/api/player/trophies';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTrophies(data.trophies);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch trophies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrophies();
  }, [userId]);

  const handleFeature = async (trophyId: string, isFeatured: boolean) => {
    try {
      await fetch('/api/player/trophies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trophyId, isFeatured: !isFeatured }),
      });
      fetchTrophies();
    } catch (error) {
      console.error('Failed to update trophy:', error);
    }
  };

  const handleShare = async (trophyId: string) => {
    try {
      await fetch('/api/player/trophies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trophyId }),
      });
      // Could trigger a share dialog here
    } catch (error) {
      console.error('Failed to share trophy:', error);
    }
  };

  const getTrophyIcon = (type: string) => {
    switch (type) {
      case 'GOLD':
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 'SILVER':
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 'BRONZE':
        return <Medal className="w-6 h-6 text-orange-600" />;
      default:
        return <Star className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getTrophyBg = (type: string) => {
    switch (type) {
      case 'GOLD':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'SILVER':
        return 'bg-gray-400/10 border-gray-400/20';
      case 'BRONZE':
        return 'bg-orange-600/10 border-orange-600/20';
      default:
        return 'bg-muted/50 border-border/50';
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="w-5 h-5" />
            Trophy Cabinet
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="w-5 h-5" />
            Trophy Cabinet
          </CardTitle>
          <CardDescription>Your achievements will appear here</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-3 opacity-20" />
          <p>Win tournaments to earn trophies!</p>
          <p className="text-xs mt-2">Top 3 finishes are automatically added</p>
        </CardContent>
      </Card>
    );
  }

  const featuredTrophies = trophies.filter(t => t.isFeatured);
  const otherTrophies = trophies.filter(t => !t.isFeatured);

  return (
    <Card className="bg-card border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy className="w-5 h-5" />
            Trophy Cabinet
            <Badge className={cn(primaryBg, primaryColor, "border-transparent")}>
              {stats.total} total
            </Badge>
          </CardTitle>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">{stats.gold} Gold</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-muted-foreground">{stats.silver} Silver</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full bg-orange-600" />
            <span className="text-muted-foreground">{stats.bronze} Bronze</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Featured Trophies */}
        {featuredTrophies.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Pin className="w-3 h-3" />
              Featured
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featuredTrophies.slice(0, compact ? 2 : 4).map((trophy) => (
                <div 
                  key={trophy.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    getTrophyBg(trophy.trophyType)
                  )}
                >
                  {getTrophyIcon(trophy.trophyType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {trophy.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trophy.earnedAt).toLocaleDateString("en-IN", { 
                        year: 'numeric', 
                        month: 'short' 
                      })}
                    </p>
                  </div>
                  {!userId && (
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleFeature(trophy.id, true)}
                      >
                        <Pin className="w-3 h-3 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleShare(trophy.id)}
                      >
                        <Share2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Trophies */}
        <div className={cn(
          "grid gap-2",
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        )}>
          {otherTrophies.slice(0, compact ? 3 : 8).map((trophy) => (
            <div 
              key={trophy.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg border",
                getTrophyBg(trophy.trophyType)
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center">
                {getTrophyIcon(trophy.trophyType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {trophy.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {trophy.position ? `#${trophy.position} • ` : ''}
                  {new Date(trophy.earnedAt).toLocaleDateString("en-IN", { month: 'short', year: 'numeric' })}
                </p>
              </div>
              {!userId && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleFeature(trophy.id, false)}
                >
                  <Pin className="w-3 h-3 text-muted-foreground opacity-50" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {trophies.length > (compact ? 5 : 8) && (
          <Button variant="ghost" className="w-full mt-3 text-muted-foreground">
            View all {trophies.length} trophies
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
