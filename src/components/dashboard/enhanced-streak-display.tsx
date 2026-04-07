"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Trophy, Zap, TrendingUp, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakData {
  currentWinStreak: number;
  bestWinStreak: number;
  currentMatchStreak: number;
  bestMatchStreak: number;
  streakStartedAt: string | null;
}

interface EnhancedStreakDisplayProps {
  streak: StreakData | null;
  loading?: boolean;
  sport?: "cornhole" | "darts";
}

export function EnhancedStreakDisplay({ 
  streak, 
  loading = false,
  sport = "cornhole"
}: EnhancedStreakDisplayProps) {
  const primaryColor = sport === "cornhole" ? "text-green-500" : "text-teal-500";
  const primaryBg = sport === "cornhole" ? "bg-green-500/10" : "bg-teal-500/10";

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardContent className="p-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (!streak) {
    return null;
  }

  const { currentWinStreak, bestWinStreak, currentMatchStreak, bestMatchStreak, streakStartedAt } = streak;
  
  // Calculate streak progress (to next milestone)
  const milestones = [3, 5, 10, 15, 20, 25, 50];
  const nextMilestone = milestones.find(m => m > currentWinStreak) || 100;
  const progressToMilestone = ((currentWinStreak / nextMilestone) * 100);

  // Days in streak
  const streakDays = streakStartedAt 
    ? Math.floor((Date.now() - new Date(streakStartedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Card className="bg-gradient-to-br from-orange-500/5 to-red-500/5 border-orange-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Flame className="w-5 h-5 text-orange-500" />
          Win Streak
          {currentWinStreak >= 5 && (
            <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 ml-2">
              🔥 On Fire!
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-6">
          {/* Current Streak - Large */}
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold text-orange-500">
                {currentWinStreak}
              </span>
              <span className="text-muted-foreground">wins in a row</span>
            </div>
            
            {/* Progress to next milestone */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Next milestone: {nextMilestone} wins</span>
                <span>{currentWinStreak}/{nextMilestone}</span>
              </div>
              <Progress 
                value={progressToMilestone} 
                className="h-2 bg-orange-500/10"
              />
            </div>
            
            {/* Streak duration */}
            {streakStartedAt && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Started {new Date(streakStartedAt).toLocaleDateString("en-IN", { 
                  day: "numeric", 
                  month: "short" 
                })} ({streakDays} days ago)</span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
              <p className="text-lg font-bold text-foreground">{bestWinStreak}</p>
              <p className="text-xs text-muted-foreground">Best Streak</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
              <Zap className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-bold text-foreground">{currentMatchStreak}</p>
              <p className="text-xs text-muted-foreground">Match Streak</p>
            </div>
          </div>
        </div>

        {/* Streak Milestones */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {milestones.slice(0, 5).map((milestone) => (
            <Badge
              key={milestone}
              variant="outline"
              className={cn(
                "transition-all",
                currentWinStreak >= milestone
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-500"
                  : "text-muted-foreground border-border/50"
              )}
            >
              {currentWinStreak >= milestone ? "✓" : ""} {milestone}+
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
