'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, Trophy, Target, Zap, Calendar, 
  Medal, Award, BarChart3 
} from 'lucide-react';
import { SkillRadarChart } from '@/components/progress/skill-radar-chart';
import { WinStreakCounter, FormIndicator } from '@/components/progress/win-streak-counter';

interface PlayerProgressData {
  id: string;
  currentWinStreak: number;
  longestWinStreak: number;
  currentLossStreak: number;
  attackSkill: number;
  defenseSkill: number;
  consistency: number;
  clutchFactor: number;
  endurance: number;
  versatility: number;
  tournamentWinRate: number;
  avgPlacement: number;
  podiumRate: number;
  recentWins: number;
  recentLosses: number;
  recentWinRate: number;
  recentResults: string[];
  totalMatchesPlayed: number;
  totalTournaments: number;
  totalWins: number;
  totalPodiums: number;
  totalPoints: number;
}

export default function ProgressPage() {
  const params = useParams();
  const sport = params.sport as string;
  const theme = sport === 'cornhole' ? 'green' : 'teal';

  const [progress, setProgress] = useState<PlayerProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [sport]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/player/progress?sport=${sport.toUpperCase()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProgress(data.progress);
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const skills = progress ? {
    attack: progress.attackSkill,
    defense: progress.defenseSkill,
    consistency: progress.consistency,
    clutch: progress.clutchFactor,
    endurance: progress.endurance,
    versatility: progress.versatility,
  } : {
    attack: 50, defense: 50, consistency: 50, clutch: 50, endurance: 50, versatility: 50,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold text-${theme}-600 flex items-center gap-2`}>
              <BarChart3 className="h-6 w-6" />
              Progress & Stats
            </h1>
            <p className="text-gray-500 mt-1">
              Track your skill development and achievements
            </p>
          </div>
          {progress && (
            <FormIndicator recentResults={progress.recentResults} theme={theme} />
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Skill Radar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Skill Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <SkillRadarChart skills={skills} size={220} theme={theme} />
                </CardContent>
              </Card>

              {/* Win Streak */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Streak Tracker
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress ? (
                    <WinStreakCounter
                      currentStreak={progress.currentWinStreak}
                      longestStreak={progress.longestWinStreak}
                      currentLossStreak={progress.currentLossStreak}
                      recentResults={progress.recentResults}
                      theme={theme}
                      size="lg"
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Play matches to start your streak!
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Trophy className={`h-6 w-6 mx-auto mb-2 text-${theme}-500`} />
                  <div className="text-2xl font-bold">{progress?.totalWins || 0}</div>
                  <div className="text-xs text-gray-500">Total Wins</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Medal className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                  <div className="text-2xl font-bold">{progress?.totalPodiums || 0}</div>
                  <div className="text-xs text-gray-500">Podiums</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{progress?.totalTournaments || 0}</div>
                  <div className="text-xs text-gray-500">Tournaments</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Award className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">{progress?.totalPoints || 0}</div>
                  <div className="text-xs text-gray-500">Points</div>
                </CardContent>
              </Card>
            </div>

            {/* Tournament Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tournament Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {progress?.tournamentWinRate?.toFixed(1) || 0}%
                    </div>
                    <div className="text-xs text-gray-500">Win Rate</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {progress?.avgPlacement?.toFixed(1) || '-'}
                    </div>
                    <div className="text-xs text-gray-500">Avg Placement</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {progress?.podiumRate?.toFixed(1) || 0}%
                    </div>
                    <div className="text-xs text-gray-500">Podium Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skill Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Skill Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(skills).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      attack: 'Attack',
                      defense: 'Defense',
                      consistency: 'Consistency',
                      clutch: 'Clutch Factor',
                      endurance: 'Endurance',
                      versatility: 'Versatility',
                    };
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{labels[key]}</span>
                          <span className="font-medium">{Math.round(value)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${theme}-500 rounded-full transition-all duration-500`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
