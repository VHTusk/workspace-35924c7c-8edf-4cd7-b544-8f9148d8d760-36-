"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisputeMatchData {
  id: string;
  playedAt: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  outcome: string | null;
  opponent: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  tournament: {
    id: string;
    name: string;
  } | null;
  timeRemaining: number;
  hasDispute: boolean;
}

interface DisputeButtonProps {
  matchId: string;
  userId: string;
  sport: string;
  timeRemaining: number; // milliseconds
  hasDispute: boolean;
  matchData: DisputeMatchData;
  onDisputeClick: (match: DisputeMatchData) => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  showTimeRemaining?: boolean;
}

export function DisputeButton({
  matchId,
  userId,
  sport,
  timeRemaining,
  hasDispute,
  matchData,
  onDisputeClick,
  disabled = false,
  size = "sm",
  variant = "outline",
  className,
  showTimeRemaining = false,
}: DisputeButtonProps) {
  const isCornhole = sport === "cornhole";
  
  // Check if dispute window has expired
  const isExpired = timeRemaining <= 0;
  
  // Determine button state
  const canDispute = !isExpired && !hasDispute;
  
  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Expired";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  // Determine button styling
  const getButtonStyle = () => {
    if (hasDispute) {
      return "text-gray-400 border-gray-200 cursor-not-allowed";
    }
    if (isExpired) {
      return "text-gray-400 border-gray-200 cursor-not-allowed";
    }
    if (variant === "outline") {
      return isCornhole
        ? "text-green-600 border-green-200 hover:bg-green-50"
        : "text-teal-600 border-teal-200 hover:bg-teal-50";
    }
    return "";
  };

  const handleClick = () => {
    if (canDispute) {
      onDisputeClick(matchData);
    }
  };

  // Render different states
  if (hasDispute) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              variant="ghost"
              disabled
              className={cn("gap-1", className)}
            >
              <AlertTriangle className="w-4 h-4" />
              Disputed
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>You have already filed a dispute for this match</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isExpired) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              variant="ghost"
              disabled
              className={cn("gap-1", className)}
            >
              <Clock className="w-4 h-4" />
              Expired
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>72-hour dispute window has expired</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={handleClick}
            disabled={disabled}
            className={cn("gap-1", getButtonStyle(), className)}
          >
            <AlertTriangle className="w-4 h-4" />
            Dispute
            {showTimeRemaining && (
              <span className="text-xs opacity-70">
                ({formatTimeRemaining(timeRemaining)})
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to file a dispute for this match result</p>
          <p className="text-xs text-gray-400">
            Window closes in {formatTimeRemaining(timeRemaining)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact version for inline use
export function DisputeButtonCompact({
  matchId,
  sport,
  timeRemaining,
  hasDispute,
  matchData,
  onDisputeClick,
  className,
}: Omit<DisputeButtonProps, "userId" | "size" | "variant" | "showTimeRemaining">) {
  const isExpired = timeRemaining <= 0;
  const canDispute = !isExpired && !hasDispute;

  if (hasDispute) {
    return (
      <span className={cn("text-xs text-gray-400", className)}>
        Disputed
      </span>
    );
  }

  if (isExpired) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => canDispute && onDisputeClick(matchData)}
      className={cn(
        "h-7 text-xs gap-1",
        sport === "cornhole"
          ? "text-green-600 hover:text-green-700 hover:bg-green-50"
          : "text-teal-600 hover:text-teal-700 hover:bg-teal-50",
        className
      )}
    >
      <AlertTriangle className="w-3 h-3" />
      Dispute
    </Button>
  );
}
