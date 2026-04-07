'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  Users,
  Zap,
  ArrowRight,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TournamentRecommendation {
  id: string;
  name: string;
  type: string;
  scope: string | null;
  location: string;
  city: string | null;
  state: string | null;
  startDate: string;
  endDate: string;
  regDeadline: string;
  entryFee: number;
  prizePool: number;
  currentRegistrations: number;
  availableSpots: number;
  matchScore: number;
  matchReasons: string[];
  daysUntilStart: number;
}

interface RecommendationsSummary {
  totalMatches: number;
  thisWeek: number;
  topRecommendation: TournamentRecommendation | null;
  hasAvailability: boolean;
}

interface RecommendationsWidgetProps {
  compact?: boolean;
  showAll?: boolean;
}

export default function RecommendationsWidget({
  compact = false,
  showAll = false,
}: RecommendationsWidgetProps) {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === 'cornhole';
  const theme = isCornhole ? 'green' : 'teal';

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RecommendationsSummary | null>(null);
  const [recommendations, setRecommendations] = useState<TournamentRecommendation[]>([]);

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch summary
      const summaryRes = await fetch('/api/recommendations/tournaments?summary=true');
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data);
      }

      // If showAll, fetch full list
      if (showAll) {
        const listRes = await fetch('/api/recommendations/tournaments?limit=5');
        if (listRes.ok) {
          const listData = await listRes.json();
          setRecommendations(listData.data.recommendations);
        }
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getMatchScoreWidth = (score: number) => {
    return Math.min(score, 100);
  };

  // Loading skeleton
  if (loading) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No availability set
  if (summary && !summary.hasAvailability) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Tournament Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-3">
              Set your availability to get personalized tournament recommendations
            </p>
            <Link href={`/${sport}/availability`}>
              <Button
                className={cn(
                  'bg-' + theme + '-500 hover:bg-' + theme + '-600'
                )}
              >
                Set Availability
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No recommendations
  if (summary && summary.totalMatches === 0) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Tournament Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">
              No tournaments match your availability right now. Check back soon!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact view (for dashboard widget)
  if (compact && summary) {
    return (
      <Link href={`/${sport}/availability?tab=recommendations`} className="block">
        <Card className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {summary.thisWeek} tournaments match your availability
                  </p>
                  <p className="text-sm text-gray-500">
                    {summary.totalMatches} total recommendations
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Full widget view
  return (
    <Card className="bg-white border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Recommended for You
          </CardTitle>
          <Link href={`/${sport}/tournaments?filter=recommended`}>
            <Button variant="ghost" size="sm" className="text-gray-500">
              See All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        {summary && (
          <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-gray-900">{summary.thisWeek}</p>
              <p className="text-xs text-gray-500">This Week</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-gray-900">{summary.totalMatches}</p>
              <p className="text-xs text-gray-500">Total Matches</p>
            </div>
          </div>
        )}

        {/* Top Recommendation */}
        {summary?.topRecommendation && !showAll && (
          <div className="space-y-3">
            <TournamentCard
              tournament={summary.topRecommendation}
              sport={sport}
              theme={theme}
              isTop={true}
            />
          </div>
        )}

        {/* Full List */}
        {showAll && recommendations.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recommendations.map((tournament, index) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                sport={sport}
                theme={theme}
                isTop={index === 0}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Tournament Card Component
function TournamentCard({
  tournament,
  sport,
  theme,
  isTop = false,
}: {
  tournament: TournamentRecommendation;
  sport: string;
  theme: string;
  isTop?: boolean;
}) {
  const matchScoreColor = getMatchScoreColor(tournament.matchScore);

  return (
    <Link href={`/${sport}/tournaments/${tournament.id}`}>
      <Card className={cn(
        "bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer",
        isTop && "ring-2 ring-amber-200"
      )}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">{tournament.name}</h4>
                {isTop && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                    Top Match
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {tournament.city || tournament.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(tournament.startDate)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <Badge className={cn("text-xs", matchScoreColor)}>
                {tournament.matchScore}% match
              </Badge>
            </div>
          </div>

          {/* Match Score Bar */}
          <div className="mb-3">
            <Progress
              value={getMatchScoreWidth(tournament.matchScore)}
              className="h-1.5"
            />
          </div>

          {/* Match Reasons */}
          <div className="flex flex-wrap gap-1 mb-3">
            {tournament.matchReasons.slice(0, 3).map((reason, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-white rounded-full text-gray-600"
              >
                {reason}
              </span>
            ))}
          </div>

          {/* Details Row */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-gray-500">
                <Users className="w-3 h-3" />
                {tournament.currentRegistrations}/{tournament.availableSpots + tournament.currentRegistrations}
              </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(tournament.prizePool)} prize
              </span>
            </div>
            <span className="flex items-center gap-1 text-gray-500">
              <Clock className="w-3 h-3" />
              {tournament.daysUntilStart > 0
                ? `${tournament.daysUntilStart}d left`
                : 'Starting soon'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
