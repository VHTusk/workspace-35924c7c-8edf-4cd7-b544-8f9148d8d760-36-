"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TierProgressProps {
  currentPoints: number;
  currentTier: string;
  sport: string;
  compact?: boolean;
}

interface TierInfo {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const tierConfig: Record<string, TierInfo> = {
  UNRANKED: {
    name: "Unranked",
    minPoints: 0,
    maxPoints: 999,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
  },
  BRONZE: {
    name: "Bronze",
    minPoints: 1000,
    maxPoints: 1499,
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-300",
  },
  SILVER: {
    name: "Silver",
    minPoints: 1500,
    maxPoints: 1999,
    color: "text-gray-600",
    bgColor: "bg-gray-200",
    borderColor: "border-gray-400",
  },
  GOLD: {
    name: "Gold",
    minPoints: 2000,
    maxPoints: 2999,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-400",
  },
  PLATINUM: {
    name: "Platinum",
    minPoints: 3000,
    maxPoints: 4999,
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    borderColor: "border-cyan-400",
  },
  DIAMOND: {
    name: "Diamond",
    minPoints: 5000,
    maxPoints: 999999,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-400",
  },
};

const tierOrder = ["UNRANKED", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

export function TierProgress({ currentPoints, currentTier, sport, compact = false }: TierProgressProps) {
  const isCornhole = sport === "cornhole";
  const primaryColor = isCornhole ? "bg-green-500" : "bg-teal-500";

  // Find current and next tier
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const nextTier = currentTierIndex < tierOrder.length - 1 ? tierOrder[currentTierIndex + 1] : null;
  const currentTierInfo = tierConfig[currentTier] || tierConfig.UNRANKED;
  const nextTierInfo = nextTier ? tierConfig[nextTier] : null;

  // Calculate progress to next tier
  const progressToNextTier = nextTierInfo
    ? Math.min(
        100,
        ((currentPoints - currentTierInfo.minPoints) /
          (nextTierInfo.minPoints - currentTierInfo.minPoints)) *
          100
      )
    : 100;

  const pointsToNextTier = nextTierInfo
    ? Math.max(0, nextTierInfo.minPoints - currentPoints)
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          className={cn(
            "font-medium",
            currentTierInfo.bgColor,
            currentTierInfo.color,
            currentTierInfo.borderColor
          )}
        >
          {currentTierInfo.name}
        </Badge>
        {nextTierInfo && (
          <span className="text-xs text-gray-500">
            {pointsToNextTier.toLocaleString()} pts to {nextTierInfo.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current Tier Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "text-base px-3 py-1",
              currentTierInfo.bgColor,
              currentTierInfo.color,
              currentTierInfo.borderColor
            )}
          >
            {currentTierInfo.name}
          </Badge>
          <span className="text-sm text-gray-500">
            {currentPoints.toLocaleString()} points
          </span>
        </div>
        {nextTierInfo && (
          <span className="text-sm text-gray-600">
            Next: <strong className={nextTierInfo.color}>{nextTierInfo.name}</strong>
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {nextTierInfo && (
        <div className="space-y-1">
          <Progress value={progressToNextTier} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{currentTierInfo.minPoints.toLocaleString()}</span>
            <span>{pointsToNextTier.toLocaleString()} points to {nextTierInfo.name}</span>
            <span>{nextTierInfo.minPoints.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Tier Ladder (visual) */}
      <div className="flex items-center gap-1 mt-4">
        {tierOrder.map((tier, index) => {
          const info = tierConfig[tier];
          const isCurrent = tier === currentTier;
          const isPassed = index < currentTierIndex;

          return (
            <div
              key={tier}
              className={cn(
                "flex-1 h-2 rounded-full transition-all",
                isCurrent && "ring-2 ring-offset-1",
                isPassed || isCurrent ? info.bgColor : "bg-gray-100",
                isCurrent && info.borderColor
              )}
              title={info.name}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Unranked</span>
        <span>Diamond</span>
      </div>
    </div>
  );
}

// Tier Badge component for display in lists/cards
export function TierBadge({ tier, size = "default" }: { tier: string; size?: "sm" | "default" | "lg" }) {
  const info = tierConfig[tier] || tierConfig.UNRANKED;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-sm px-2 py-0.5",
    lg: "text-base px-3 py-1",
  };

  return (
    <Badge
      className={cn(
        "font-medium",
        sizeClasses[size],
        info.bgColor,
        info.color,
        info.borderColor
      )}
    >
      {info.name}
    </Badge>
  );
}
