"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  MapPin, 
  Calendar, 
  Users,
  Star,
  ArrowRight,
  Check,
  Loader2,
  Sparkles
} from "lucide-react";

interface StepDiscoverProps {
  data: {
    followedPlayers: string[];
  };
  onChange: (data: Partial<StepDiscoverProps["data"]>) => void;
  sport: string;
  city?: string;
  state?: string;
}

interface Tournament {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  prizePool: number;
  maxPlayers: number;
  registrationsCount: number;
  scope: string;
}

interface TopPlayer {
  id: string;
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
  visiblePoints: number;
  hiddenElo: number;
}

export function StepDiscover({ data, onChange, sport, city, state }: StepDiscoverProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole 
    ? "bg-green-600 hover:bg-green-700 text-white" 
    : "bg-teal-600 hover:bg-teal-700 text-white";

  useEffect(() => {
    // Fetch recommended tournaments
    const fetchTournaments = async () => {
      try {
        const params = new URLSearchParams({
          sport: sport.toUpperCase(),
          status: "REGISTRATION_OPEN",
          limit: "3",
        });
        
        const response = await fetch(`/api/tournaments?${params}`);
        const result = await response.json();
        
        if (result.tournaments) {
          setTournaments(result.tournaments.slice(0, 3));
        }
      } catch (error) {
        console.error("Failed to fetch tournaments:", error);
      } finally {
        setLoadingTournaments(false);
      }
    };

    // Fetch top players
    const fetchTopPlayers = async () => {
      try {
        const params = new URLSearchParams({
          sport: sport.toUpperCase(),
          limit: "6",
        });
        
        const response = await fetch(`/api/leaderboard?${params}`);
        const result = await response.json();
        
        if (result.players) {
          setTopPlayers(result.players.slice(0, 6));
        }
      } catch (error) {
        console.error("Failed to fetch top players:", error);
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchTournaments();
    fetchTopPlayers();
  }, [sport]);

  const toggleFollowPlayer = (playerId: string) => {
    const current = data.followedPlayers;
    const updated = current.includes(playerId)
      ? current.filter(id => id !== playerId)
      : [...current, playerId];
    onChange({ followedPlayers: updated });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTier = (elo: number) => {
    if (elo >= 1900) return { name: "Diamond", color: "text-blue-500" };
    if (elo >= 1700) return { name: "Platinum", color: "text-cyan-500" };
    if (elo >= 1500) return { name: "Gold", color: "text-yellow-500" };
    if (elo >= 1300) return { name: "Silver", color: "text-gray-400" };
    return { name: "Bronze", color: "text-amber-600" };
  };

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 mb-3">
          <Sparkles className="w-8 h-8 text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">You're almost there!</h3>
        <p className="text-gray-500 text-sm mt-1">
          Discover tournaments and connect with top players
        </p>
      </div>

      {/* Recommended Tournaments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Recommended Tournaments
          </h4>
        </div>

        {loadingTournaments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : tournaments.length > 0 ? (
          <div className="space-y-2">
            {tournaments.map((tournament) => (
              <Card key={tournament.id} className="bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{tournament.name}</h5>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {tournament.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {tournament.scope}
                      </Badge>
                      <p className="text-sm font-semibold mt-1">
                        {formatCurrency(tournament.prizePool)}
                      </p>
                      <p className="text-xs text-gray-500">
                        <Users className="w-3 h-3 inline mr-1" />
                        {tournament.registrationsCount}/{tournament.maxPlayers}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Trophy className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No tournaments available right now</p>
            <p className="text-xs text-gray-400">Check back soon for new events!</p>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => window.location.href = `/${sport}/tournaments`}
        >
          View All Tournaments
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Top Players to Follow */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Top Players to Follow
          </h4>
          <span className="text-sm text-gray-500">
            {data.followedPlayers.length} selected
          </span>
        </div>

        {loadingPlayers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : topPlayers.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {topPlayers.map((player) => {
              const isFollowing = data.followedPlayers.includes(player.id);
              const tier = getTier(player.hiddenElo);
              
              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isFollowing
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-gray-200">
                        {player.firstName[0]}{player.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {player.firstName} {player.lastName}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs ${tier.color}`}>
                          {tier.name}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {player.visiblePoints} pts
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFollowPlayer(player.id)}
                      className={`p-1.5 rounded-full transition-colors ${
                        isFollowing
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      {isFollowing ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Star className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No players to show</p>
          </div>
        )}
      </div>

      {/* Completion Note */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
        <div className="flex items-start gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCornhole ? "bg-green-100" : "bg-teal-100"}`}>
            <Check className={`w-4 h-4 ${primaryTextClass}`} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900">Ready to complete!</h4>
            <p className="text-xs text-gray-500 mt-1">
              Click "Complete Setup" to finish. You can always update your preferences later from your profile settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
