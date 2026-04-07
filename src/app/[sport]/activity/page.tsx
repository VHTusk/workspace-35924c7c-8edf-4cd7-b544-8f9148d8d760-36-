'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Activity, Trophy, Medal, TrendingUp, Gamepad2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Sidebar from '@/components/layout/sidebar';

interface ActivityItem {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string;
  title: string;
  description: string;
  metadata: string | null;
  createdAt: string;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  MATCH_RESULT: Gamepad2,
  TOURNAMENT_WIN: Trophy,
  ACHIEVEMENT: Medal,
  RANK_CHANGE: TrendingUp,
};

const ACTIVITY_COLORS: Record<string, string> = {
  MATCH_RESULT: 'text-blue-500 bg-blue-50',
  TOURNAMENT_WIN: 'text-yellow-500 bg-yellow-50',
  ACHIEVEMENT: 'text-purple-500 bg-purple-50',
  RANK_CHANGE: 'text-green-500 bg-green-50',
};

export default function ActivityFeedPage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const url = cursor && loadMore
        ? `/api/activity-feed?cursor=${cursor}&limit=20`
        : '/api/activity-feed?limit=20';
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (res.ok) {
        setActivities((prev) => loadMore ? [...prev, ...data.activities] : data.activities);
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold text-${theme}-600 flex items-center gap-2`}>
              <Activity className="h-6 w-6" />
              Activity Feed
            </h1>
            <p className="text-gray-500 mt-1">
              See what's happening in the community
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchActivities(false)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Activity List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
              <p className="text-gray-500">
                Activity will appear here as matches are played and tournaments complete
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] || Activity;
              const colorClass = ACTIVITY_COLORS[activity.type] || 'text-gray-500 bg-gray-50';

              return (
                <Card key={activity.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">
                            {activity.actorName}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatTime(activity.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">
                          {activity.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {activity.description}
                        </p>
                        {activity.type === 'TOURNAMENT_WIN' && (
                          <Badge className={`mt-2 bg-${theme}-500`}>
                            <Trophy className="h-3 w-3 mr-1" />
                            Tournament Winner
                          </Badge>
                        )}
                        {activity.type === 'RANK_CHANGE' && (
                          <Badge variant="secondary" className="mt-2">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Rank Up
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {hasMore && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchActivities(true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
