"use client";

import { cn } from "@/lib/utils";
import { POINTS_TIERS as TIERS } from "@/lib/tier";
import { Crown, Medal, Award, Star, Diamond, Trophy } from "lucide-react";

interface RankBadgeProps {
  tier: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const TIER_ICONS: Record<string, React.ElementType> = {
  Champion: Trophy,
  Diamond: Diamond,
  Platinum: Star,
  Gold: Crown,
  Silver: Medal,
  Bronze: Award,
};

export function RankBadge({ tier, size = "md", showIcon = true, className }: RankBadgeProps) {
  const tierInfo = TIERS.find((t) => t.name === tier) || TIERS[0];
  const IconComponent = TIER_ICONS[tierInfo.name] || Award;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white shadow-sm",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: tierInfo.color }}
    >
      {showIcon && <IconComponent className={iconSizes[size]} />}
      <span>{tierInfo.name}</span>
    </div>
  );
}

interface WinStreakBadgeProps {
  streak: number;
  type: "current" | "best";
  size?: "sm" | "md" | "lg";
}

export function WinStreakBadge({ streak, type, size = "md" }: WinStreakBadgeProps) {
  if (streak <= 0) return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const isCurrent = type === "current";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium gap-1.5",
        sizeClasses[size],
        isCurrent
          ? "bg-orange-100 text-orange-700 border border-orange-200"
          : "bg-purple-100 text-purple-700 border border-purple-200"
      )}
    >
      {isCurrent && <span className="animate-pulse">🔥</span>}
      <span>
        {streak} {isCurrent ? "Win Streak!" : "Best Streak"}
      </span>
    </div>
  );
}
