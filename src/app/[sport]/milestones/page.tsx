'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Milestone, Trophy, Target, Star, Clock, CheckCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface MilestoneData {
  id: string;
  type: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  points: number;
  achievedAt: string | null;
  icon: string;
}

interface MilestoneGroup {
  category: string;
  milestones: MilestoneData[];
}

const MILESTONE_ICONS: Record<string, React.ElementType> = {
  matches: Target,
  wins: Trophy,
  tournaments: Milestone,
  points: Star,
  streak: Clock,
};

export default function MilestonesPage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [milestones, setMilestones] = useState<MilestoneGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    achieved: 0,
    pointsEarned: 0,
  });

  useEffect(() => {
    fetchMilestones();
  }, []);

  const fetchMilestones = async () => {
    try {
      const res = await fetch('/api/milestones');
      const data = await res.json();
      if (res.ok) {
        setMilestones(data.milestones || []);
        setStats(data.stats || { total: 0, achieved: 0, pointsEarned: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getProgress = (current: number, target: number) => {
    return Math.min(100, Math.round((current / target) * 100));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-2xl font-bold text-${theme}-600 flex items-center gap-2`}>
            <Milestone className="h-6 w-6" />
            Milestones
          </h1>
          <p className="text-gray-500 mt-1">
            Track your achievements and earn bonus points
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Milestones</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">{stats.achieved}</p>
              </div>
              <p className="text-xs text-gray-500">Achieved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.pointsEarned}</p>
              <p className="text-xs text-gray-500">Points Earned</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : milestones.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Milestone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No milestones available</h3>
              <p className="text-gray-500">
                Start playing tournaments to unlock milestones!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {milestones.map((group) => (
              <Card key={group.category}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {MILESTONE_ICONS[group.category] && (
                      <span className={theme === 'green' ? 'text-green-500' : 'text-teal-500'}>
                        {(() => {
                          const Icon = MILESTONE_ICONS[group.category];
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </span>
                    )}
                    {group.category} Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {group.milestones.map((milestone) => {
                      const progress = getProgress(milestone.currentValue, milestone.targetValue);
                      const isAchieved = !!milestone.achievedAt;
                      const Icon = MILESTONE_ICONS[milestone.icon] || Target;

                      return (
                        <div
                          key={milestone.id}
                          className={`p-4 rounded-lg border ${
                            isAchieved
                              ? `bg-${theme}-50 border-${theme}-200`
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                  isAchieved
                                    ? `bg-${theme}-500 text-white`
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                {isAchieved ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : (
                                  <Icon className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                                  {isAchieved && (
                                    <Badge className={`bg-${theme}-500`}>
                                      +{milestone.points} pts
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{milestone.description}</p>
                              </div>
                            </div>
                            {isAchieved && (
                              <span className="text-xs text-gray-500">
                                {formatDate(milestone.achievedAt!)}
                              </span>
                            )}
                          </div>

                          {!isAchieved && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600">
                                  {milestone.currentValue} / {milestone.targetValue}
                                </span>
                                <span className="text-gray-500">{progress}%</span>
                              </div>
                              <Progress
                                value={progress}
                                className={`h-2 ${theme === 'green' ? '[&>div]:bg-green-500' : '[&>div]:bg-teal-500'}`}
                              />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">Reward</span>
                                <Badge variant="outline" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  {milestone.points} pts
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
