/**
 * Global Rating Badge Component
 * v3.39.0 - Displays player's global rating with tier
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTierColor } from '@/lib/global-rating';

interface GlobalRatingBadgeProps {
  globalElo: number;
  tier: string;
  isProvisional?: boolean;
  provisionalMatches?: number;
  rank?: number;
  showRating?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GlobalRatingBadge({
  globalElo,
  tier,
  isProvisional = false,
  provisionalMatches = 0,
  rank,
  showRating = true,
  size = 'md',
}: GlobalRatingBadgeProps) {
  const tierColor = getTierColor(tier);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const badge = (
    <Badge
      className={`${sizeClasses[size]} font-semibold border`}
      style={{
        backgroundColor: tier === 'UNRANKED' ? '#F3F4F6' : `${tierColor}20`,
        color: tierColor,
        borderColor: tierColor,
      }}
    >
      {tier === 'UNRANKED' ? (
        <span className="flex items-center gap-1">
          <span>?</span>
          {showRating && <span className="opacity-75">Provisional</span>}
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          {tierIcon(tier)}
          {showRating && <span>{Math.round(globalElo)}</span>}
        </span>
      )}
    </Badge>
  );

  if (isProvisional) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-semibold">Provisional Player</p>
              <p className="text-sm text-muted-foreground">
                {10 - provisionalMatches} rated matches until ranked
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (rank && rank <= 10) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {badge}
              <span className="text-xs font-medium text-muted-foreground">
                #{rank}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ranked #{rank} globally</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

function tierIcon(tier: string) {
  switch (tier) {
    case 'DIAMOND':
      return <span>💎</span>;
    case 'PLATINUM':
      return <span>🔷</span>;
    case 'GOLD':
      return <span>🥇</span>;
    case 'SILVER':
      return <span>🥈</span>;
    case 'BRONZE':
      return <span>🥉</span>;
    default:
      return null;
  }
}

interface ProvisionalProgressProps {
  matchesPlayed: number;
  totalNeeded?: number;
}

export function ProvisionalProgress({ matchesPlayed, totalNeeded = 10 }: ProvisionalProgressProps) {
  const progress = Math.min(matchesPlayed / totalNeeded * 100, 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Provisional Progress</span>
        <span>{matchesPlayed}/{totalNeeded}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {totalNeeded - matchesPlayed} more rated matches until you're ranked
      </p>
    </div>
  );
}
