"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Trophy, 
  Users, 
  TrendingUp,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFeedItem {
  id: string;
  type: string;
  actorName: string;
  title: string;
  description: string;
  isRead: boolean;
  createdAt: string;
  linkUrl: string | null;
}

interface ActivityFeedData {
  activities: ActivityFeedItem[];
  unreadCount: number;
}

interface PersonalizedActivityFeedProps {
  sport?: "cornhole" | "darts";
}

export function PersonalizedActivityFeed({ 
  sport = "cornhole"
}: PersonalizedActivityFeedProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ActivityFeedData | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const abortControllerRef = useRef<AbortController | null>(null);

  const primaryColor = sport === "cornhole" ? "text-green-500" : "text-teal-500";
  const primaryBg = sport === "cornhole" ? "bg-green-500/10" : "bg-teal-500/10";

  const fetchFeed = useCallback(async (type?: string) => {
    // Abort any in-flight request from previous effect
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    try {
      const url = type && type !== 'all' 
        ? `/api/player/activity-feed?type=${type}`
        : '/api/player/activity-feed';
      const response = await fetch(url, { signal });
      if (response.ok && !signal.aborted) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Failed to fetch activity feed:', error);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchFeed(filter === 'all' ? undefined : filter);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filter, fetchFeed]);

  const markAsRead = async (itemIds?: string[]) => {
    try {
      await fetch('/api/player/activity-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemIds ? { itemIds } : { markAll: true }),
      });
      
      if (data) {
        setData({
          ...data,
          activities: data.activities.map(a => 
            itemIds 
              ? (itemIds.includes(a.id) ? { ...a, isRead: true } : a)
              : { ...a, isRead: true }
          ),
          unreadCount: itemIds ? data.unreadCount - itemIds.length : 0,
        });
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'MATCH_RESULT':
        return <Activity className="w-4 h-4" />;
      case 'TOURNAMENT_WIN':
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 'ACHIEVEMENT':
        return <Trophy className="w-4 h-4 text-purple-500" />;
      case 'FRIEND_ACTIVITY':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'RANK_CHANGE':
        return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityBg = (type: string) => {
    switch (type) {
      case 'TOURNAMENT_WIN':
        return 'bg-yellow-500/5 border-yellow-500/20';
      case 'ACHIEVEMENT':
        return 'bg-purple-500/5 border-purple-500/20';
      case 'FRIEND_ACTIVITY':
        return 'bg-blue-500/5 border-blue-500/20';
      case 'RANK_CHANGE':
        return 'bg-emerald-500/5 border-emerald-500/20';
      default:
        return 'bg-muted/50 border-border/50';
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Activity className="w-5 h-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.activities.length === 0) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Activity className="w-5 h-5" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No recent activity</p>
          <p className="text-xs mt-2">Follow players to see their matches and achievements</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Activity className="w-5 h-5" />
            Activity Feed
            {data.unreadCount > 0 && (
              <Badge className={cn(primaryBg, primaryColor, "border-transparent")}>
                {data.unreadCount} new
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => markAsRead()}
                className="text-muted-foreground"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => fetchFeed()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mt-3">
          <TabsList className="grid grid-cols-5 h-8">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="MATCH_RESULT" className="text-xs">Matches</TabsTrigger>
            <TabsTrigger value="TOURNAMENT_WIN" className="text-xs">Wins</TabsTrigger>
            <TabsTrigger value="FRIEND_ACTIVITY" className="text-xs">Friends</TabsTrigger>
            <TabsTrigger value="ACHIEVEMENT" className="text-xs">Awards</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-2">
            {data.activities.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
                  getActivityBg(item.type),
                  !item.isRead && "border-l-2 border-l-primary"
                )}
                onClick={() => !item.isRead && markAsRead([item.id])}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  item.isRead ? "bg-muted" : cn(primaryBg, primaryColor)
                )}>
                  {getActivityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm",
                      item.isRead ? "text-muted-foreground" : "text-foreground font-medium"
                    )}>
                      {item.title}
                    </p>
                    {!item.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>{item.actorName}</span>
                    <span>•</span>
                    <span>
                      {new Date(item.createdAt).toLocaleDateString("en-IN", { 
                        day: 'numeric', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
