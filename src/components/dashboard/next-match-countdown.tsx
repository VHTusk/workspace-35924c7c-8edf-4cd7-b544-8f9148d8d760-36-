"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, MapPin, Trophy, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NextMatchCountdownProps {
  matchId: string;
  opponent: string;
  tournament: string;
  tournamentId: string;
  scheduledTime: string | Date | null;
  court?: string;
  sport: "cornhole" | "darts";
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total };
}

function useCountdown(targetDate: Date | null): TimeRemaining {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() => 
    targetDate ? calculateTimeRemaining(targetDate) : { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  );

  useEffect(() => {
    if (!targetDate) return;

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeRemaining;
}

export function NextMatchCountdown({
  matchId,
  opponent,
  tournament,
  tournamentId,
  scheduledTime,
  court,
  sport,
}: NextMatchCountdownProps) {
  const primaryColor = sport === "cornhole" ? "green" : "teal";
  
  // Parse target date - must be done before any conditional returns
  const targetDate = scheduledTime ? new Date(scheduledTime) : null;
  const countdown = useCountdown(targetDate);
  
  // Handle case where no scheduled time
  if (!scheduledTime) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Next Match</p>
              <p className="text-sm text-muted-foreground">vs {opponent}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Time TBD</p>
              <p className="text-xs text-muted-foreground">{tournament}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Check if match has passed
  if (countdown.total <= 0) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Match Starting Soon</p>
              <p className="text-sm text-muted-foreground">vs {opponent}</p>
            </div>
            <Link 
              href={`/${sport}/tournaments/${tournamentId}`}
              className="text-xs text-primary hover:underline"
            >
              View Details
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const isUrgent = countdown.total < 2 * 60 * 60 * 1000; // Less than 2 hours
  const isToday = countdown.days === 0;
  
  return (
    <Card className={cn(
      "overflow-hidden",
      isUrgent
        ? "bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-red-200 dark:border-red-800"
        : isToday
          ? sport === "cornhole"
            ? "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800"
            : "bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800"
          : "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-border"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className={cn(
              "w-4 h-4",
              isUrgent ? "text-red-500" : sport === "cornhole" ? "text-green-500" : "text-teal-500"
            )} />
            <span className="text-sm font-medium text-foreground">{tournament}</span>
          </div>
          {court && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {court}
            </span>
          )}
        </div>
        
        {/* Countdown */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {countdown.days > 0 && (
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold",
                isUrgent ? "text-red-600 dark:text-red-400" : "text-foreground"
              )}>
                {countdown.days}
              </div>
              <div className="text-xs text-muted-foreground">Days</div>
            </div>
          )}
          {countdown.days > 0 && <span className="text-xl text-muted-foreground">:</span>}
          <div className="text-center">
            <div className={cn(
              "text-2xl font-bold",
              isUrgent ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}>
              {String(countdown.hours).padStart(2, "0")}
            </div>
            <div className="text-xs text-muted-foreground">Hours</div>
          </div>
          <span className="text-xl text-muted-foreground">:</span>
          <div className="text-center">
            <div className={cn(
              "text-2xl font-bold",
              isUrgent ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}>
              {String(countdown.minutes).padStart(2, "0")}
            </div>
            <div className="text-xs text-muted-foreground">Min</div>
          </div>
          <span className="text-xl text-muted-foreground">:</span>
          <div className="text-center">
            <div className={cn(
              "text-2xl font-bold",
              isUrgent ? "text-red-600 dark:text-red-400" : "text-foreground"
            )}>
              {String(countdown.seconds).padStart(2, "0")}
            </div>
            <div className="text-xs text-muted-foreground">Sec</div>
          </div>
        </div>
        
        {/* Opponent */}
        <div className="text-center">
          <span className="text-sm text-muted-foreground">vs </span>
          <span className="font-medium text-foreground">{opponent}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini countdown for compact display
interface MiniCountdownProps {
  scheduledTime: string | Date;
  className?: string;
}

export function MiniCountdown({ scheduledTime, className }: MiniCountdownProps) {
  const targetDate = new Date(scheduledTime);
  const countdown = useCountdown(targetDate);
  
  if (countdown.total <= 0) {
    return (
      <span className={cn("text-xs text-amber-600 dark:text-amber-400", className)}>
        Starting now
      </span>
    );
  }
  
  const formatTime = () => {
    if (countdown.days > 0) {
      return `${countdown.days}d ${countdown.hours}h`;
    }
    if (countdown.hours > 0) {
      return `${countdown.hours}h ${countdown.minutes}m`;
    }
    return `${countdown.minutes}m ${countdown.seconds}s`;
  };
  
  const isUrgent = countdown.total < 30 * 60 * 1000; // Less than 30 minutes
  
  return (
    <span className={cn(
      "text-xs font-medium",
      isUrgent ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
      className
    )}>
      {formatTime()}
    </span>
  );
}
