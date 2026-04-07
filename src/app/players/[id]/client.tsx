"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  MapPin,
  Calendar,
  Medal,
  Share2,
  ChevronRight,
  Building2,
  Target,
  Users,
  TrendingUp,
  Award,
  Crown,
  Swords,
  Clock,
} from "lucide-react";

interface PlayerData {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  district: string | null;
  avatar: string | null;
  memberSince: string;
  sport: string;
  organizations: Array<{
    id: string;
    name: string;
    type: string;
    sport: string;
    logoUrl: string | null;
  }>;
}

interface PlayerStats {
  points: number;
  elo: number | null;
  wins: number;
  losses: number;
  winStreak: number;
  bestStreak: number;
  tier: string;
  matchesPlayed: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  highestElo: number | null;
  rank: number | null;
}

interface Tournament {
  id: string;
  name: string;
  sport: string;
  date: string;
  status: string;
  scope: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earnedAt: string;
  badge: {
    code: string;
    name: string;
    iconUrl: string | null;
    tier: string;
  } | null;
}

interface Milestone {
  id: string;
  type: string;
  title: string;
  description: string;
  earnedAt: string;
}

interface Props {
  playerId: string;
  sport: string | null;
}

const tierColors: Record<string, string> = {
  DIAMOND: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  PLATINUM: "bg-slate-300/10 text-slate-300 border-slate-300/30",
  GOLD: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  SILVER: "bg-gray-400/10 text-gray-300 border-gray-400/30",
  BRONZE: "bg-orange-600/10 text-orange-400 border-orange-600/30",
  UNRANKED: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const tierIcons: Record<string, React.ReactNode> = {
  DIAMOND: <Crown className="w-4 h-4" />,
  PLATINUM: <Medal className="w-4 h-4" />,
  GOLD: <Trophy className="w-4 h-4" />,
  SILVER: <Medal className="w-4 h-4" />,
  BRONZE: <Award className="w-4 h-4" />,
  UNRANKED: null,
};

export function PublicPlayerClient({ playerId, sport }: Props) {
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  const selectedSport = sport || searchParams.get("sport");

  useEffect(() => {
    fetchPlayer();
  }, [playerId, selectedSport]);

  const fetchPlayer = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSport) params.append("sport", selectedSport);

      const response = await fetch(`/api/public/players/${playerId}?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPlayer(data.data.player);
        setStats(data.data.stats);
        setTournaments(data.data.tournaments);
        setAchievements(data.data.achievements);
        setMilestones(data.data.milestones);
      }
    } catch (error) {
      console.error("Failed to fetch player:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${player?.name} | VALORHIVE`,
          text: `Check out ${player?.name}'s profile on VALORHIVE`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Player Not Found</h2>
        <p className="text-muted-foreground mb-4">
          This player doesn&apos;t exist or their profile is private.
        </p>
        <Link href="/tournaments">
          <Button>Browse Tournaments</Button>
        </Link>
      </div>
    );
  }

  const winRate =
    stats && stats.matchesPlayed > 0
      ? Math.round((stats.wins / stats.matchesPlayed) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-3xl font-bold border-4 border-background shadow-lg">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  player.name.charAt(0)
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{player.name}</h1>
                {stats && stats.tier && (
                  <Badge variant="outline" className={tierColors[stats.tier] || ""}>
                    {tierIcons[stats.tier]}
                    <span className="ml-1">{stats.tier}</span>
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-4">
                {player.city && player.state && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {player.city}, {player.state}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Member since {new Date(player.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                </div>
              </div>

              {/* Organizations */}
              {player.organizations.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {player.organizations.map((org) => (
                    <Link
                      key={org.id}
                      href={`/${org.sport.toLowerCase()}/organizations/${org.id}`}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                    >
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="w-5 h-5 rounded" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                      <span className="text-sm">{org.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Link href={`/${player.sport.toLowerCase()}/login?redirect=/players/${playerId}`}>
                <Button size="sm">
                  <Swords className="w-4 h-4 mr-2" />
                  Challenge
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats */}
          <div className="space-y-6">
            {/* Points Card */}
            {stats && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Points</p>
                      <p className="text-2xl font-bold text-primary">{stats.points.toLocaleString()}</p>
                    </div>
                    {stats.elo !== null && (
                      <div>
                        <p className="text-sm text-muted-foreground">ELO Rating</p>
                        <p className="text-2xl font-bold">{stats.elo}</p>
                      </div>
                    )}
                    {stats.rank && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Leaderboard Rank</p>
                        <p className="text-xl font-bold">
                          #{stats.rank.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Match Stats */}
            {stats && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Match Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{stats.matchesPlayed}</p>
                      <p className="text-xs text-muted-foreground">Matches</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">{stats.wins}</p>
                      <p className="text-xs text-muted-foreground">Wins</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-400">{stats.losses}</p>
                      <p className="text-xs text-muted-foreground">Losses</p>
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span className="font-medium">{winRate}%</span>
                    </div>
                    <Progress value={winRate} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Streak</p>
                      <p className="font-medium">{stats.winStreak} wins</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Best Streak</p>
                      <p className="font-medium">{stats.bestStreak} wins</p>
                    </div>
                    {stats.highestElo && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Peak ELO</p>
                        <p className="font-medium">{stats.highestElo}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tournament Stats */}
            {stats && (
              <Card className="bg-gradient-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Tournament Record
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold">{stats.tournamentsPlayed}</p>
                      <p className="text-xs text-muted-foreground">Played</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-400">{stats.tournamentsWon}</p>
                      <p className="text-xs text-muted-foreground">Won</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Activity */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="tournaments">
              <TabsList>
                <TabsTrigger value="tournaments" className="gap-2">
                  <Trophy className="w-4 h-4" />
                  Tournaments ({tournaments.length})
                </TabsTrigger>
                <TabsTrigger value="achievements" className="gap-2">
                  <Award className="w-4 h-4" />
                  Achievements ({achievements.length})
                </TabsTrigger>
                <TabsTrigger value="milestones" className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Milestones ({milestones.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tournaments" className="mt-4">
                <Card className="bg-gradient-card border-border/50">
                  <CardContent className="p-0">
                    {tournaments.length > 0 ? (
                      <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                        {tournaments.map((t) => (
                          <Link
                            key={t.id}
                            href={`/tournaments/${t.id}`}
                            className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                          >
                            <div>
                              <p className="font-medium">{t.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {t.sport}
                                </Badge>
                                <span>
                                  {new Date(t.date).toLocaleDateString("en-IN", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No tournament history yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="achievements" className="mt-4">
                <Card className="bg-gradient-card border-border/50">
                  <CardContent className="p-0">
                    {achievements.length > 0 ? (
                      <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                        {achievements.map((a) => (
                          <div key={a.id} className="flex items-start gap-4 p-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              {a.badge?.iconUrl ? (
                                <img
                                  src={a.badge.iconUrl}
                                  alt={a.title}
                                  className="w-6 h-6"
                                />
                              ) : (
                                <Award className="w-5 h-5 text-amber-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{a.title}</p>
                              <p className="text-sm text-muted-foreground">{a.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Earned {new Date(a.earnedAt).toLocaleDateString("en-IN", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No achievements yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="milestones" className="mt-4">
                <Card className="bg-gradient-card border-border/50">
                  <CardContent className="p-0">
                    {milestones.length > 0 ? (
                      <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                        {milestones.map((m) => (
                          <div key={m.id} className="flex items-start gap-4 p-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <TrendingUp className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{m.title}</p>
                              <p className="text-sm text-muted-foreground">{m.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(m.earnedAt).toLocaleDateString("en-IN", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No milestones yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
