"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EloHistoryPoint {
  date: string;
  elo: number;
  change?: number;
}

interface EloSparklineProps {
  currentElo: number;
  history?: EloHistoryPoint[];
  sport?: "cornhole" | "darts";
  showCard?: boolean;
  className?: string;
}

// Generate a simple SVG sparkline
function SparklineSVG({ 
  data, 
  width = 120, 
  height = 40,
  color = "#22c55e"
}: { 
  data: number[]; 
  width?: number; 
  height?: number;
  color?: string;
}) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-50">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeWidth="2"
          strokeDasharray="4,4"
        />
      </svg>
    );
  }
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  
  // Determine if trend is up or down
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  const isUp = lastValue >= firstValue;
  const lineColor = isUp ? "#22c55e" : "#ef4444";
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Fill area */}
      <polygon
        points={`0,${height - padding} ${points} ${width},${height - padding}`}
        fill="url(#sparklineGradient)"
      />
      
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * (width - padding * 2) + padding}
        cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
        r="3"
        fill={lineColor}
      />
    </svg>
  );
}

export function EloSparkline({ 
  currentElo, 
  history = [], 
  sport = "cornhole",
  showCard = true,
  className 
}: EloSparklineProps) {
  // Calculate trend from history
  let trend: "up" | "down" | "stable" = "stable";
  let change = 0;
  
  if (history.length >= 2) {
    const lastTwo = history.slice(-2);
    const diff = lastTwo[1].elo - lastTwo[0].elo;
    change = diff;
    trend = diff > 0 ? "up" : diff < 0 ? "down" : "stable";
  }
  
  // Extract just the ELO values for the sparkline
  const eloValues = history.map(h => h.elo);
  
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" 
    ? "text-emerald-500" 
    : trend === "down" 
      ? "text-red-500" 
      : "text-gray-500";
  
  if (!showCard) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <SparklineSVG 
          data={eloValues.length > 1 ? eloValues : [currentElo - 10, currentElo]} 
          color={sport === "cornhole" ? "#22c55e" : "#14b8a6"}
        />
        <div className="text-right">
          <div className="text-lg font-bold text-foreground">{currentElo}</div>
          {change !== 0 && (
            <div className={cn("text-xs flex items-center gap-0.5", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {change > 0 ? "+" : ""}{change}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <Card className={cn("bg-white dark:bg-card border border-border", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          ELO Rating
          {trend !== "stable" && (
            <TrendIcon className={cn("w-4 h-4", trendColor)} />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-foreground">{currentElo}</div>
            {change !== 0 && (
              <div className={cn("text-sm flex items-center gap-1", trendColor)}>
                <TrendIcon className="w-4 h-4" />
                {change > 0 ? "+" : ""}{change} from last match
              </div>
            )}
          </div>
          
          <SparklineSVG 
            data={eloValues.length > 1 ? eloValues : [currentElo - 10, currentElo]} 
            width={100}
            height={50}
            color={sport === "cornhole" ? "#22c55e" : "#14b8a6"}
          />
        </div>
        
        {/* Tier indicator */}
        <div className="mt-3 flex items-center gap-2">
          <TierBadge elo={currentElo} />
        </div>
      </CardContent>
    </Card>
  );
}

// Tier badge component
function TierBadge({ elo }: { elo: number }) {
  const getTier = (elo: number) => {
    if (elo >= 1900) return { name: "Diamond", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", emoji: "💠" };
    if (elo >= 1700) return { name: "Platinum", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", emoji: "💎" };
    if (elo >= 1500) return { name: "Gold", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", emoji: "🥇" };
    if (elo >= 1300) return { name: "Silver", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", emoji: "🥈" };
    return { name: "Bronze", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", emoji: "🥉" };
  };
  
  const tier = getTier(elo);
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      tier.color
    )}>
      <span>{tier.emoji}</span>
      <span>{tier.name}</span>
    </span>
  );
}

// Mini ELO badge for compact display
export function EloBadge({ elo, change }: { elo: number; change?: number }) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-bold text-foreground">{elo}</span>
      {change !== undefined && change !== 0 && (
        <span className={cn(
          "text-xs font-medium",
          isPositive ? "text-emerald-500" : isNegative ? "text-red-500" : "text-gray-500"
        )}>
          {isPositive ? "+" : ""}{change}
        </span>
      )}
    </div>
  );
}
