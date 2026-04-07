"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBannerProps {
  currentStreak: number;
  bestStreak: number;
  sport: "cornhole" | "darts";
}

export function StreakBanner({ currentStreak, bestStreak, sport }: StreakBannerProps) {
  const isOnFire = currentStreak >= 3;
  const isBestStreak = currentStreak === bestStreak && currentStreak > 0;
  
  if (currentStreak === 0) {
    return null;
  }

  return (
    <Card className={cn(
      "overflow-hidden",
      isOnFire 
        ? "bg-gradient-to-r from-orange-500 to-red-500 border-0 text-white" 
        : sport === "cornhole"
          ? "bg-gradient-to-r from-green-500 to-emerald-600 border-0 text-white"
          : "bg-gradient-to-r from-teal-500 to-cyan-600 border-0 text-white"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              isOnFire ? "bg-white/20" : "bg-white/10"
            )}>
              <Flame className={cn(
                "w-7 h-7",
                isOnFire ? "animate-pulse" : ""
              )} />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {currentStreak} Win{currentStreak > 1 ? "s" : ""} Streak
              </p>
              <p className="text-white/80 text-sm">
                {isBestStreak 
                  ? "🔥 Tied with your best streak!" 
                  : `${bestStreak - currentStreak} more to beat your best`}
              </p>
            </div>
          </div>
          
          {isOnFire && (
            <div className="text-right">
              <div className="text-4xl">🔥</div>
              <p className="text-xs text-white/80 mt-1">On Fire!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Mini streak badge for compact display
interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  if (streak === 0) return null;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      streak >= 5 
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" 
        : streak >= 3 
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
      className
    )}>
      <Flame className="w-3 h-3" />
      <span>{streak}</span>
    </div>
  );
}
