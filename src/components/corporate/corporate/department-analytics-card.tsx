"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DepartmentAnalyticsCardProps {
  id: string;
  name: string;
  totalEmployees: number;
  activePlayers: number;
  participationRate: number;
  totalPoints: number;
  tournamentsPlayed: number;
  trend: number;
  rank?: number;
  onClick?: () => void;
  isCornhole?: boolean;
}

export function DepartmentAnalyticsCard({
  name,
  totalEmployees,
  activePlayers,
  participationRate,
  totalPoints,
  tournamentsPlayed,
  trend,
  rank,
  onClick,
  isCornhole = true,
}: DepartmentAnalyticsCardProps) {
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  const getTrendIcon = () => {
    if (trend > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (trend < 0) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (trend > 0) return "text-green-600";
    if (trend < 0) return "text-red-600";
    return "text-gray-500";
  };

  const getParticipationColor = () => {
    if (participationRate >= 70) return "bg-green-500";
    if (participationRate >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card
      className={cn(
        "bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {rank && (
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  rank === 1
                    ? "bg-amber-100 text-amber-700"
                    : rank === 2
                    ? "bg-gray-100 text-gray-700"
                    : rank === 3
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-50 text-gray-500"
                )}
              >
                {rank}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">{name}</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
            {getTrendIcon()}
            <span>{Math.abs(trend)}</span>
          </div>
        </div>

        {/* Participation Rate Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Participation Rate</span>
            <span className="font-medium text-gray-900">{participationRate}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", getParticipationColor())}
              style={{ width: `${participationRate}%` }}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-3 w-3 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {activePlayers}/{totalEmployees}
            </p>
            <p className="text-xs text-gray-500">Players</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="h-3 w-3 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900">{totalPoints}</p>
            <p className="text-xs text-gray-500">Points</p>
          </div>
          <div className={cn("text-center p-2 rounded-lg", primaryBgClass)}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Building2 className={cn("h-3 w-3", primaryTextClass)} />
            </div>
            <p className={cn("text-sm font-semibold", primaryTextClass)}>
              {tournamentsPlayed}
            </p>
            <p className="text-xs text-gray-500">Events</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini sparkline component for trend visualization
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  isPositive?: boolean;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  isPositive = true,
}: SparklineProps) {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
