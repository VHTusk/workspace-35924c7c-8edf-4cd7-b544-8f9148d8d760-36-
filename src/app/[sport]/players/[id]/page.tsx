"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Target,
  TrendingUp,
  MapPin,
  Calendar,
  Users,
  Medal,
  Crown,
  Building2,
  Loader2,
  ChevronRight,
  Heart,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import FollowButton from "@/components/follow/follow-button";
import { useFollowCountRefresh } from "@/hooks/use-follow-count";

interface PlayerProfile {
  player: {
    id: string;
    name: string;
    city?: string;
    state?: string;
    district?: string;
    avatar?: string;
    memberSince: string;
    organizations: Array<{ id: string; name: string; type: string }>;
  };
  stats: {
    points: number;
    elo: number;
    wins: number;
    losses: number;
    winStreak: number;
    tier: string;
    rank: number | null;
  };
  social: {
    followers: number;
    following: number;
  };
  recentMatches: Array<{
    id: string;
    tournament: string;
    opponent: { id: string; name: string };
    won: boolean;
    score: string;
    date: string;
  }>;
  milestones: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    date: string;
  }>;
  tournaments: Array<{
    id: string;
    name: string;
    date: string | null;
    status: string;
  }>;
}

const tierColors: Record<string, string> = {
  UNRANKED: "bg-gray-100 text-gray-600",
  BRONZE: "bg-orange-100 text-orange-700",
  SILVER: "bg-gray-200 text-gray-700",
  GOLD: "bg-amber-100 text-amber-700",
  PLATINUM: "bg-cyan-100 text-cyan-700",
  DIAMOND: "bg-purple-100 text-purple-700",
};

export default function PublicPlayerProfilePage() {
  const params = useParams();
  const sport = params.sport as string;
  const playerId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState("");
  const followRefreshKey = useFollowCountRefresh();

  useEffect(() => {
    fetchProfile();
  }, [playerId, sport, followRefreshKey]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/public/player/${playerId}?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        setError("Player not found");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72 min-h-screen">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72 min-h-screen">
          <div className="p-6 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{error || "Player not found"}</p>
            <Link href={`/${sport}/leaderboard`}>
              <Button className={cn("mt-4 text-white", primaryBtnClass)}>
                Back to Leaderboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-5xl">
        {/* Profile Header */}
        <Card className="bg-card border-border shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Left: Player Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-4 border-border">
                  <AvatarImage src={profile.player.avatar} />
                  <AvatarFallback className={cn("text-2xl font-bold text-white", primaryBtnClass)}>
                    {profile.player.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{profile.player.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge className={cn("border", tierColors[profile.stats.tier])}>
                      {profile.stats.tier} Tier
                    </Badge>
                    {profile.player.city && profile.player.state && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {profile.player.city}, {profile.player.state}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Member since {new Date(profile.player.memberSince).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </p>
                </div>
              </div>

              {/* Right: Stats & Actions */}
              <div className="flex items-center gap-6">
                {/* Ranking Display */}
                <div className={cn("rounded-xl p-4 text-center", primaryBgClass)}>
                  {profile.stats.rank === 1 && <Crown className="w-5 h-5 mx-auto mb-1 text-amber-500" />}
                  <span className={cn("text-3xl font-bold", primaryTextClass)}>
                    #{profile.stats.rank || "--"}
                  </span>
                  <p className="text-xs text-muted-foreground">Ranking</p>
                </div>

                {/* Follow Button */}
                <FollowButton
                  targetType="user"
                  targetId={profile.player.id}
                  sport={sport.toUpperCase()}
                  size="lg"
                />
              </div>
            </div>

            {/* Social Stats */}
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Heart className={cn("w-4 h-4", primaryTextClass)} />
                  <p className="text-xl font-bold text-foreground">{profile.social.followers}</p>
                </div>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <UserCheck className={cn("w-4 h-4", primaryTextClass)} />
                  <p className="text-xl font-bold text-foreground">{profile.social.following}</p>
                </div>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">{profile.stats.wins + profile.stats.losses}</p>
                <p className="text-xs text-muted-foreground">Matches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold text-foreground">{profile.stats.points.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Points</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-foreground">{profile.stats.elo}</p>
              <p className="text-xs text-muted-foreground">ELO Rating</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold text-foreground">
                {profile.stats.wins}W - {profile.stats.losses}L
              </p>
              <p className="text-xs text-muted-foreground">Win/Loss</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50 shadow-sm">
            <CardContent className="p-4 text-center">
              <Medal className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
              <p className="text-2xl font-bold text-foreground">
                {profile.stats.wins + profile.stats.losses > 0 
                  ? Math.round((profile.stats.wins / (profile.stats.wins + profile.stats.losses)) * 100) 
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="matches" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="matches">Recent Matches</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
          </TabsList>

          <TabsContent value="matches">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Recent Matches</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.recentMatches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No matches played yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.recentMatches.map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                            match.won ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>
                            {match.won ? "W" : "L"}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">vs {match.opponent.name}</p>
                            <p className="text-xs text-muted-foreground">{match.tournament}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{match.score}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(match.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Tournament History</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.tournaments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No tournaments entered yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.tournaments.map((tournament) => (
                      <Link
                        key={tournament.id}
                        href={`/${sport}/tournaments/${tournament.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="font-medium text-foreground">{tournament.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tournament.date ? new Date(tournament.date).toLocaleDateString() : "TBD"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{tournament.status}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="milestones">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Achievements</CardTitle>
                <CardDescription>Milestones and accomplishments</CardDescription>
              </CardHeader>
              <CardContent>
                {profile.milestones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Medal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No milestones achieved yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900/50"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{milestone.title}</p>
                          <p className="text-sm text-muted-foreground">{milestone.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(milestone.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Organizations */}
        {profile.player.organizations.length > 0 && (
          <Card className="bg-card border-border/50 shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {profile.player.organizations.map((org) => (
                  <Link
                    key={org.id}
                    href={`/${sport}/organizations/${org.id}`}
                  >
                    <Badge variant="outline" className="px-4 py-2 cursor-pointer hover:bg-muted/50">
                      {org.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  );
}
