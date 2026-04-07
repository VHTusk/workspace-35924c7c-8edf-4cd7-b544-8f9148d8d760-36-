"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  Share2,
  Download,
  Medal,
  Crown,
  Users,
  Twitter,
  Facebook,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecapData {
  tournament: {
    id: string;
    name: string;
    type: string;
    scope: string;
    location: string;
    city: string | null;
    state: string | null;
    startDate: string;
    endDate: string;
    status: string;
  };
  results: Array<{
    rank: number;
    userId: string;
    name: string;
    city: string | null;
    points: number;
    matches: number;
    wins: number;
  }>;
  stats: {
    totalParticipants: number;
    totalMatches: number;
    duration: string;
  };
}

export default function TournamentRecapPage() {
  const params = useParams();
  const sport = params.sport as string;
  const tournamentId = params.id as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecapData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRecap();
  }, [tournamentId]);

  const fetchRecap = async () => {
    try {
      const response = await fetch(`/api/public/tournament/recap?tournamentId=${tournamentId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError("Tournament recap not available");
      }
    } catch (err) {
      console.error("Failed to fetch recap:", err);
      setError("Failed to load recap");
    } finally {
      setLoading(false);
    }
  };

  const shareToTwitter = () => {
    const text = `🏆 ${data?.tournament.name} Results!\n\nWinner: ${data?.results[0]?.name}\n\nCheck out the full results at VALORHIVE!`;
    const url = window.location.href;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareToFacebook = () => {
    const url = window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const shareWhatsApp = () => {
    const text = `🏆 ${data?.tournament.name} Results!\n\nWinner: ${data?.results[0]?.name}\n\nCheck out the full results at VALORHIVE! ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: "🥇", bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-700" };
    if (rank === 2) return { emoji: "🥈", bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-600" };
    if (rank === 3) return { emoji: "🥉", bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-700" };
    return { emoji: `#${rank}`, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600" };
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error || "Not Found"}</h2>
          <Link href={`/${sport}/tournaments`}>
            <Button>Browse Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white pt-16 pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge className="bg-green-100 text-green-700 mb-4">Tournament Complete</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{data.tournament.name}</h1>
          <div className="flex items-center justify-center gap-4 text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(data.tournament.startDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {data.tournament.city || data.tournament.location}
            </span>
          </div>
        </div>

        {/* Winner Card */}
        {data.results.length > 0 && (
          <Card className="bg-gradient-to-r from-amber-100 to-amber-50 border-amber-200 shadow-lg mb-8">
            <CardContent className="p-8 text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-amber-500" />
              <p className="text-sm text-amber-600 font-medium mb-2">🏆 CHAMPION</p>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{data.results[0].name}</h2>
              {data.results[0].city && (
                <p className="text-gray-600">{data.results[0].city}</p>
              )}
              <div className="flex items-center justify-center gap-6 mt-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.results[0].points}</p>
                  <p className="text-xs text-gray-500">Points Earned</p>
                </div>
                <div className="w-px h-10 bg-amber-200" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.results[0].wins}W</p>
                  <p className="text-xs text-gray-500">Matches Won</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Share Buttons */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Button onClick={shareWhatsApp} variant="outline" className="gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </Button>
          <Button onClick={shareToTwitter} variant="outline" className="gap-2">
            <Twitter className="w-4 h-4" />
            Twitter
          </Button>
          <Button onClick={shareToFacebook} variant="outline" className="gap-2">
            <Facebook className="w-4 h-4" />
            Facebook
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-white border-gray-100 shadow-sm text-center">
            <CardContent className="p-4">
              <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalParticipants}</p>
              <p className="text-xs text-gray-500">Participants</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm text-center">
            <CardContent className="p-4">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalMatches}</p>
              <p className="text-xs text-gray-500">Matches</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm text-center">
            <CardContent className="p-4">
              <Calendar className="w-6 h-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold text-gray-900">{data.stats.duration}</p>
              <p className="text-xs text-gray-500">Duration</p>
            </CardContent>
          </Card>
        </div>

        {/* Final Standings */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Medal className="w-6 h-6 text-amber-500" />
              Final Standings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.results.map((player) => {
                const badge = getRankBadge(player.rank);
                return (
                  <div
                    key={player.userId}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border",
                      badge.bg,
                      badge.border,
                      player.rank === 1 && "border-2"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold", badge.text)}>
                      {badge.emoji}
                    </div>
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={cn(primaryTextClass, "bg-gray-100")}>
                        {player.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{player.name}</p>
                      <p className="text-xs text-gray-500">{player.city || ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">+{player.points} pts</p>
                      <p className="text-xs text-gray-500">{player.wins}W - {player.matches - player.wins}L</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">
            Want to compete in future tournaments?
          </p>
          <Link href={`/${sport}/register`}>
            <Button className={cn("text-white", primaryBtnClass)}>
              Join VALORHIVE
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
