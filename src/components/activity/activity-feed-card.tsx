"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Trophy,
  Users,
  Target,
  TrendingUp,
  Calendar,
  Medal,
  Zap,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ActivityItem {
  id: string;
  type: "match_won" | "match_lost" | "tournament_registered" | "tournament_won" | "followed_player" | "rank_change" | "achievement";
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    tournamentName?: string;
    opponentName?: string;
    score?: string;
    rank?: number;
    achievement?: string;
  };
}

interface ActivityFeedCardProps {
  sport: string;
  limit?: number;
}

export function ActivityFeedCard({ sport, limit = 5 }: ActivityFeedCardProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  useEffect(() => {
    fetchActivities();
  }, [sport, limit]);

  const fetchActivities = async () => {
    try {
      const response = await fetch("/api/activity-feed?limit=" + limit);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity feed:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "match_won":
        return <Trophy className="w-4 h-4 text-green-500" />;
      case "match_lost":
        return <Target className="w-4 h-4 text-red-500" />;
      case "tournament_registered":
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case "tournament_won":
        return <Medal className="w-4 h-4 text-amber-500" />;
      case "followed_player":
        return <Users className="w-4 h-4 text-purple-500" />;
      case "rank_change":
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case "achievement":
        return <Zap className="w-4 h-4 text-orange-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityBg = (type: string) => {
    switch (type) {
      case "match_won":
        return "bg-green-100 dark:bg-green-900/30";
      case "match_lost":
        return "bg-red-100 dark:bg-red-900/30";
      case "tournament_registered":
        return "bg-blue-100 dark:bg-blue-900/30";
      case "tournament_won":
        return "bg-amber-100 dark:bg-amber-900/30";
      case "followed_player":
        return "bg-purple-100 dark:bg-purple-900/30";
      case "rank_change":
        return "bg-emerald-100 dark:bg-emerald-900/30";
      case "achievement":
        return "bg-orange-100 dark:bg-orange-900/30";
      default:
        return "bg-muted";
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className={cn("w-5 h-5", primaryTextClass)} />
            Recent Activity
          </CardTitle>
          <Link href={`/${sport}/activity`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {activities.length === 0 ? (
          <div className="text-center py-6">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start playing to see your activity here
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={cn("p-2 rounded-lg", getActivityBg(activity.type))}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {activity.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
