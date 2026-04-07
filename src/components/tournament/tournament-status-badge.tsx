"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  calculateTournamentStatus,
  getTournamentStatus,
  getTournamentStatusInfo,
  getDetailedTournamentStatus,
  TournamentDisplayStatus,
  TournamentStatusInfo,
} from "@/lib/tournament-status";

/**
 * TournamentStatusBadge Props
 */
export interface TournamentStatusBadgeProps {
  /** Tournament start date (ISO string or Date) */
  startDate: string | Date;
  /** Tournament end date (ISO string or Date) */
  endDate: string | Date;
  /** Database status field (optional, for more detailed status) */
  dbStatus?: string;
  /** Badge size variant */
  size?: "sm" | "md" | "lg";
  /** Badge style variant */
  variant?: "solid" | "outline" | "dot";
  /** Whether to show pulse animation for live tournaments */
  pulse?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show detailed status (for admin views) */
  detailed?: boolean;
}

/**
 * TournamentStatusBadge Component
 * 
 * A centralized component for displaying tournament status with consistent
 * color coding across the entire website.
 * 
 * Status Logic:
 * - Upcoming: current_time < tournament_start_time (Blue)
 * - Live: tournament_start_time ≤ current_time ≤ tournament_end_time (Green)
 * - Completed: current_time > tournament_end_time (Grey)
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <TournamentStatusBadge
 *   startDate={tournament.startDate}
 *   endDate={tournament.endDate}
 * />
 * 
 * // With database status for more detail
 * <TournamentStatusBadge
 *   startDate={tournament.startDate}
 *   endDate={tournament.endDate}
 *   dbStatus={tournament.status}
 *   detailed
 * />
 * 
 * // Outline variant
 * <TournamentStatusBadge
 *   startDate={tournament.startDate}
 *   endDate={tournament.endDate}
 *   variant="outline"
 * />
 * 
 * // Dot variant (minimal)
 * <TournamentStatusBadge
 *   startDate={tournament.startDate}
 *   endDate={tournament.endDate}
 *   variant="dot"
 * />
 * ```
 */
export function TournamentStatusBadge({
  startDate,
  endDate,
  dbStatus,
  size = "md",
  variant = "solid",
  pulse = true,
  className,
  detailed = false,
}: TournamentStatusBadgeProps) {
  // Get status info
  const statusInfo = detailed && dbStatus
    ? getDetailedTournamentStatus(dbStatus, startDate, endDate)
    : getTournamentStatus(dbStatus || '', startDate, endDate);

  // Size classes
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-0.5",
    lg: "text-sm px-3 py-1",
  };

  // Render dot variant
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            statusInfo.dotColor,
            statusInfo.status === "live" && pulse && "animate-pulse"
          )}
        />
        <span className={cn("text-xs font-medium", statusInfo.textClass)}>
          {statusInfo.label}
        </span>
      </span>
    );
  }

  // Render outline variant
  if (variant === "outline") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-medium border",
          sizeClasses[size],
          statusInfo.borderClass,
          statusInfo.textClass,
          "bg-transparent",
          className
        )}
      >
        {statusInfo.status === "live" && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full mr-1.5",
              statusInfo.dotColor,
              pulse && "animate-pulse"
            )}
          />
        )}
        {statusInfo.label}
      </Badge>
    );
  }

  // Render solid variant (default)
  return (
    <Badge
      className={cn(
        "font-medium text-white border-transparent",
        sizeClasses[size],
        statusInfo.bgClass,
        statusInfo.status === "live" && pulse && "animate-pulse",
        className
      )}
    >
      {statusInfo.label}
    </Badge>
  );
}

/**
 * TournamentStatusStrip Component
 * 
 * A colored strip that can be placed at the top of tournament cards
 * to indicate status at a glance.
 */
export interface TournamentStatusStripProps {
  startDate: string | Date;
  endDate: string | Date;
  dbStatus?: string;
  className?: string;
  showLabel?: boolean;
}

export function TournamentStatusStrip({
  startDate,
  endDate,
  dbStatus,
  className,
  showLabel = true,
}: TournamentStatusStripProps) {
  const statusInfo = getTournamentStatus(dbStatus || '', startDate, endDate);

  const stripColors = {
    upcoming: "bg-gradient-to-r from-blue-600 to-blue-400",
    live: "bg-gradient-to-r from-green-600 to-green-400",
    completed: "bg-gradient-to-r from-gray-500 to-gray-400",
  };

  return (
    <div
      className={cn(
        "h-1.5 rounded-t-lg",
        stripColors[statusInfo.status],
        className
      )}
      title={statusInfo.label}
    >
      {showLabel && (
        <div className="flex items-center justify-center h-full">
          <span className="text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {statusInfo.label}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get tournament status info
 * Useful for custom implementations
 */
export function useTournamentStatus(
  startDate: string | Date,
  endDate: string | Date,
  dbStatus?: string
): TournamentStatusInfo {
  return getTournamentStatus(dbStatus || '', startDate, endDate);
}

/**
 * Get card styling classes based on tournament status
 * Used to style entire tournament cards differently based on status
 */
export function getTournamentCardClasses(
  startDate: string | Date,
  endDate: string | Date,
  dbStatus?: string
): {
  cardClass: string;
  statusInfo: TournamentStatusInfo;
} {
  const statusInfo = getTournamentStatus(dbStatus || '', startDate, endDate);

  const cardClasses = {
    upcoming: "border-l-4 border-l-blue-500 hover:shadow-blue-100/50",
    live: "border-l-4 border-l-green-500 shadow-lg shadow-green-100/50 hover:shadow-green-200/50",
    completed: "border-l-4 border-l-gray-400 opacity-75 hover:opacity-100",
  };

  return {
    cardClass: cardClasses[statusInfo.status],
    statusInfo,
  };
}

export default TournamentStatusBadge;
