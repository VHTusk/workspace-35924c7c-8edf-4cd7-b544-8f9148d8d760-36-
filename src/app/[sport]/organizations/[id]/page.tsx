"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  MapPin,
  Trophy,
  Users,
  Target,
  TrendingUp,
  Crown,
  Medal,
  Loader2,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import FollowButton from "@/components/follow/follow-button";
import { useFollowCountRefresh } from "@/hooks/use-follow-count";

interface OrgProfile {
  organization: {
    id: string;
    name: string;
    type: string;
    city?: string;
    state?: string;
    district?: string;
    logoUrl?: string;
    planTier: string;
    memberSince: string;
  };
  ranking: {
    rank: number | null;
    totalOrganizations: number;
    totalPoints: number;
    avgPoints: number;
    avgElo: number;
    percentile: number;
  };
  stats: {
    totalMembers: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    tournamentsHosted: number;
  };
  social: {
    followers: number;
  };
  roster: Array<{
    id: string;
    userId: string;
    name: string;
    city?: string;
    points: number;
    elo: number;
    wins: number;
    losses: number;
    joinedAt: string;
  }>;
  tournaments: Array<{
    id: string;
    name: string;
    date: string | null;
    status: string;
    participants: number;
  }>;
}

const orgTypeLabels: Record<string, string> = {
  CLUB: "Club",
  SCHOOL: "School",
  CORPORATE: "Corporate",
  ACADEMY: "Academy",
};

const orgTypeColors: Record<string, string> = {
  CLUB: "bg-blue-100 text-blue-700 border-blue-200",
  SCHOOL: "bg-green-100 text-green-700 border-green-200",
  CORPORATE: "bg-purple-100 text-purple-700 border-purple-200",
  ACADEMY: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function PublicOrgProfilePage() {
  const params = useParams();
  const sport = params.sport as string;
  const orgId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [error, setError] = useState("");
  const followRefreshKey = useFollowCountRefresh();

  useEffect(() => {
    fetchProfile();
  }, [orgId, sport, followRefreshKey]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/public/org/${orgId}?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        setError("Organization not found");
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-16">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">{error || "Organization not found"}</p>
          <Link href={`/${sport}/leaderboard`}>
            <Button className={cn("mt-4 text-white", primaryBtnClass)}>
              Back to Leaderboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Profile Header */}
        <Card className="bg-white border-gray-100 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Left: Org Info */}
              <div className="flex items-center gap-4">
                <div className={cn("w-20 h-20 rounded-xl flex items-center justify-center", primaryBgClass)}>
                  <Building2 className={cn("w-10 h-10", primaryTextClass)} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{profile.organization.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge className={cn("border", orgTypeColors[profile.organization.type] || "bg-gray-100")}>
                      {orgTypeLabels[profile.organization.type] || profile.organization.type}
                    </Badge>
                    {profile.organization.city && profile.organization.state && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {profile.organization.city}, {profile.organization.state}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Member since {new Date(profile.organization.memberSince).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </p>
                </div>
              </div>

              {/* Right: Ranking & Actions */}
              <div className="flex items-center gap-6">
                {/* Ranking Display */}
                <div className={cn("rounded-xl p-4 text-center min-w-[140px]", primaryBgClass)}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {profile.ranking.rank === 1 && <Crown className="w-5 h-5 text-amber-500" />}
                    {profile.ranking.rank === 2 && <Medal className="w-5 h-5 text-gray-400" />}
                    {profile.ranking.rank === 3 && <Medal className="w-5 h-5 text-orange-400" />}
                    <span className={cn("text-3xl font-bold", primaryTextClass)}>
                      #{profile.ranking.rank || "--"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Org Ranking</p>
                  {profile.ranking.percentile > 0 && (
                    <Badge className="mt-1 bg-white/50 text-gray-600 text-xs">
                      Top {profile.ranking.percentile}%
                    </Badge>
                  )}
                </div>

                {/* Follow Button */}
                <FollowButton
                  targetType="org"
                  targetId={profile.organization.id}
                  sport={sport.toUpperCase()}
                  targetName={profile.organization.name}
                  size="lg"
                />
              </div>
            </div>

            {/* Social Stats */}
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-gray-100">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{profile.social.followers}</p>
                <p className="text-xs text-gray-500">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{profile.stats.totalMembers}</p>
                <p className="text-xs text-gray-500">Members</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{profile.stats.tournamentsHosted}</p>
                <p className="text-xs text-gray-500">Tournaments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold text-gray-900">{profile.ranking.totalPoints.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Points</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
              <p className="text-2xl font-bold text-gray-900">{profile.stats.totalMembers}</p>
              <p className="text-xs text-gray-500">Members</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold text-gray-900">{profile.stats.winRate}%</p>
              <p className="text-xs text-gray-500">Win Rate</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900">{profile.ranking.avgElo}</p>
              <p className="text-xs text-gray-500">Avg ELO</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="roster" className="space-y-6">
          <TabsList className="bg-white border border-gray-100">
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Top Players</CardTitle>
                <CardDescription>Members contributing to organization ranking</CardDescription>
              </CardHeader>
              <CardContent>
                {profile.roster.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No members yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {profile.roster.slice(0, 20).map((player, index) => (
                      <Link
                        key={player.id}
                        href={`/${sport}/players/${player.userId}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                            index === 0 ? "bg-amber-100 text-amber-700" :
                            index === 1 ? "bg-gray-100 text-gray-600" :
                            index === 2 ? "bg-orange-100 text-orange-700" :
                            "bg-gray-50 text-gray-500"
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{player.name}</p>
                            <p className="text-xs text-gray-500">
                              {player.wins}W - {player.losses}L
                              {player.city && ` • ${player.city}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{player.points.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Tournaments Hosted</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.tournaments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No tournaments hosted yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.tournaments.map((tournament) => (
                      <Link
                        key={tournament.id}
                        href={`/${sport}/tournaments/${tournament.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="font-medium text-gray-900">{tournament.name}</p>
                            <p className="text-xs text-gray-500">
                              {tournament.date ? new Date(tournament.date).toLocaleDateString() : "TBD"} • {tournament.participants} participants
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{tournament.status}</Badge>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
