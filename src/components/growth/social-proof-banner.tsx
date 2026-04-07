"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Users, Trophy, TrendingUp, Sparkles } from "lucide-react";

interface SocialProofStats {
  playersJoinedToday: number;
  activeTournaments: number;
  matchesPlayed: number;
  recentWinners: Array<{
    name: string;
    tournament: string;
  }>;
}

interface SocialProofBannerProps {
  sport: string;
  className?: string;
}

export function SocialProofBanner({ sport, className }: SocialProofBannerProps) {
  const [stats, setStats] = useState<SocialProofStats | null>(() => ({
    playersJoinedToday: Math.floor(Math.random() * 50) + 20,
    activeTournaments: Math.floor(Math.random() * 10) + 5,
    matchesPlayed: Math.floor(Math.random() * 200) + 100,
    recentWinners: [],
  }));
  const [currentMessage, setCurrentMessage] = useState(0);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  useEffect(() => {
    // Fetch real stats from API
    fetch(`/api/public/stats?sport=${sport}`)
      .then((res) => res.json())
      .then((data) => {
        setStats((prev) => {
          const currentStats = prev ?? {
            playersJoinedToday: Math.floor(Math.random() * 50) + 20,
            activeTournaments: Math.floor(Math.random() * 10) + 5,
            matchesPlayed: Math.floor(Math.random() * 200) + 100,
            recentWinners: [],
          };

          return {
            ...currentStats,
            playersJoinedToday: data.playersJoinedToday || currentStats.playersJoinedToday,
            activeTournaments: data.activeTournaments || currentStats.activeTournaments,
            matchesPlayed: data.matchesPlayedToday || currentStats.matchesPlayed,
            recentWinners: data.recentWinners || currentStats.recentWinners,
          };
        });
      })
      .catch(() => {
        // Keep initial random stats on error
      });
  }, [sport]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const messages = [
    { icon: Users, text: `${stats.playersJoinedToday} players joined today!` },
    { icon: Trophy, text: `${stats.activeTournaments} tournaments happening now` },
    { icon: TrendingUp, text: `${stats.matchesPlayed}+ matches played today` },
    ...(stats.recentWinners.length > 0
      ? [{ icon: Sparkles, text: `${stats.recentWinners[0].name} just won ${stats.recentWinners[0].tournament}!` }]
      : [{ icon: Sparkles, text: "Join the community and start competing!" }]),
  ];

  const currentMsg = messages[currentMessage];
  const Icon = currentMsg.icon;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-2 px-4 rounded-full",
        "bg-primary/5 border border-primary/20",
        "text-sm",
        primaryTextClass,
        className
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{currentMsg.text}</span>
    </div>
  );
}

export function SocialProofInline({ sport }: { sport: string }) {
  const [count, setCount] = useState(() => Math.floor(Math.random() * 30) + 15);

  const isCornhole = sport === "cornhole";

  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-sm",
      isCornhole ? "text-green-600" : "text-teal-600"
    )}>
      <Users className="w-3.5 h-3.5" />
      <span className="font-semibold">{count}</span>
      <span className="text-muted-foreground">joined today</span>
    </span>
  );
}
