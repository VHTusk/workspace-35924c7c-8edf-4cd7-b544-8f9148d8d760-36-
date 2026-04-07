"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trophy,
  Sparkles,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  Loader2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TournamentRecommendation {
  id: string;
  name: string;
  date: string;
  city: string;
  state: string;
  format: string;
  skillLevel: string;
  registrationFee: number;
  spotsLeft: number;
  matchScore: number;
  reason: string;
}

interface PlayerRecommendationsCardProps {
  sport: string;
  limit?: number;
}

export function PlayerRecommendationsCard({ sport, limit = 3 }: PlayerRecommendationsCardProps) {
  const [recommendations, setRecommendations] = useState<TournamentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  useEffect(() => {
    fetchRecommendations();
  }, [sport, limit]);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`/api/tournaments/recommendations?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getSkillBadgeColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "beginner":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "intermediate":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "advanced":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "professional":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-emerald-500";
    if (score >= 40) return "text-amber-500";
    return "text-muted-foreground";
  };

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className={cn("w-5 h-5", primaryTextClass)} />
              Recommended for You
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Tournaments matching your skill level
            </CardDescription>
          </div>
          <Link href={`/${sport}/tournaments`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {recommendations.length === 0 ? (
          <div className="text-center py-6">
            <Trophy className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No recommendations yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Complete your profile to get personalized recommendations
            </p>
            <Link href={`/${sport}/profile`} className="mt-3 inline-block">
              <Button size="sm" variant="outline">
                Complete Profile
              </Button>
            </Link>
          </div>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="space-y-3">
              {recommendations.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/${sport}/tournaments/${tournament.id}`}
                  className="block"
                >
                  <div className="p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{tournament.name}</p>
                          <div className={cn("flex items-center gap-0.5 text-xs", getMatchScoreColor(tournament.matchScore))}>
                            <Star className="w-3 h-3 fill-current" />
                            {tournament.matchScore}%
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tournament.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(tournament.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {tournament.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {tournament.spotsLeft} spots left
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[10px]", getSkillBadgeColor(tournament.skillLevel))}>
                        {tournament.skillLevel}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {tournament.format}
                      </Badge>
                      {tournament.registrationFee > 0 ? (
                        <span className="text-xs font-medium">₹{tournament.registrationFee}</span>
                      ) : (
                        <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Free Entry
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
