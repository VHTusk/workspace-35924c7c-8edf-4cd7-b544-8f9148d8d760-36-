'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Flame, 
  Snowflake, 
  Thermometer, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Calendar
} from 'lucide-react';

interface FormIndicatorData {
  currentForm: number;
  formLevel: 'ICY' | 'COLD' | 'NEUTRAL' | 'WARM' | 'HOT';
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
  trendMagnitude: number;
  recentResults: ('W' | 'L')[];
  recentWinRate: number;
  currentStreak: number;
  streakType: 'WIN' | 'LOSS' | 'NONE';
  last7DaysForm: number;
  last30DaysForm: number;
  last90DaysForm: number;
}

interface FormResponse {
  success: boolean;
  data: FormIndicatorData;
}

interface FormIndicatorProps {
  matches?: number;
}

const formLevelConfig: Record<string, { 
  icon: typeof Flame; 
  color: string; 
  bgColor: string; 
  description: string 
}> = {
  'HOT': {
    icon: Flame,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'On fire! Keep the momentum going',
  },
  'WARM': {
    icon: Thermometer,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    description: 'Playing well, room for improvement',
  },
  'NEUTRAL': {
    icon: Minus,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    description: 'Consistent performance',
  },
  'COLD': {
    icon: Snowflake,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Recent struggles, time to regroup',
  },
  'ICY': {
    icon: Snowflake,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    description: 'Rough patch, focus on fundamentals',
  },
};

export function FormIndicator({ matches = 10 }: FormIndicatorProps) {
  const [data, setData] = useState<FormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/player/analytics/form?matches=${matches}`);
        if (!res.ok) throw new Error('Failed to fetch form data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [matches]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Form Indicator</CardTitle>
          <CardDescription>Loading form data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Form Indicator</CardTitle>
          <CardDescription className="text-destructive">{error || 'No data available'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const form = data.data;
  const config = formLevelConfig[form.formLevel];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Form Indicator</CardTitle>
            <CardDescription>Last {matches} matches performance</CardDescription>
          </div>
          <div className={`p-2 rounded-full ${config.bgColor}`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Form Score Gauge */}
          <div className="text-center">
            <div className="relative w-32 h-16 mx-auto mb-4">
              {/* Half circle background */}
              <svg viewBox="0 0 100 50" className="w-full h-full">
                <defs>
                  <linearGradient id="formGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 45 A 40 40 0 0 1 90 45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted"
                />
                <path
                  d="M 10 45 A 40 40 0 0 1 90 45"
                  fill="none"
                  stroke="url(#formGradient)"
                  strokeWidth="8"
                  strokeDasharray={`${(form.currentForm + 10) * 2.5} 125.6`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={`text-4xl font-bold ${config.color}`}>
              {form.currentForm > 0 ? '+' : ''}{form.currentForm}
            </div>
            <Badge variant="outline" className={config.bgColor}>
              {form.formLevel}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">{config.description}</p>
          </div>

          {/* Recent Results Visualization */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Results</div>
            <div className="flex gap-1">
              {form.recentResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex-1 h-8 rounded flex items-center justify-center font-bold text-sm ${
                    result === 'W' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {result}
                </div>
              ))}
              {form.recentResults.length < matches && 
                Array.from({ length: matches - form.recentResults.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex-1 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground text-sm"
                  >
                    -
                  </div>
                ))
              }
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {form.recentWinRate.toFixed(1)}% win rate in last {form.recentResults.length} matches
            </div>
          </div>

          {/* Streak Info */}
          {form.currentStreak > 0 && (
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted">
              {form.streakType === 'WIN' ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {form.currentStreak} win streak!
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {form.currentStreak} match losing streak
                  </span>
                </>
              )}
            </div>
          )}

          {/* Trend and Period Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">7 Days</span>
              </div>
              <div className="text-lg font-bold">{form.last7DaysForm}%</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">30 Days</span>
              </div>
              <div className="text-lg font-bold">{form.last30DaysForm}%</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">90 Days</span>
              </div>
              <div className="text-lg font-bold">{form.last90DaysForm}%</div>
            </div>
          </div>

          {/* Trend Direction */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <span className="text-sm text-muted-foreground">Trend Direction</span>
            <div className="flex items-center gap-2">
              {form.trendDirection === 'RISING' && (
                <>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-600">Rising</span>
                </>
              )}
              {form.trendDirection === 'FALLING' && (
                <>
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-600">Falling</span>
                </>
              )}
              {form.trendDirection === 'STABLE' && (
                <>
                  <Minus className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium">Stable</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
