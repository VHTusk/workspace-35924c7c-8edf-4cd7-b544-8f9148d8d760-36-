/**
 * Tournament Status Utility
 * 
 * Centralized status calculation and styling for tournaments.
 * Status is determined automatically based on tournament dates.
 */

export type TournamentDisplayStatus = 'upcoming' | 'live' | 'completed';

export interface TournamentStatusInfo {
  status: TournamentDisplayStatus;
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColor: string;
}

/**
 * Calculate tournament display status based on dates
 * 
 * @param startDate - Tournament start date (ISO string or Date)
 * @param endDate - Tournament end date (ISO string or Date)
 * @returns TournamentDisplayStatus
 */
export function calculateTournamentStatus(
  startDate: string | Date,
  endDate: string | Date
): TournamentDisplayStatus {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Set to start of day for comparison
  const nowTime = now.getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();

  if (nowTime < startTime) {
    return 'upcoming';
  } else if (nowTime >= startTime && nowTime <= endTime) {
    return 'live';
  } else {
    return 'completed';
  }
}

/**
 * Get comprehensive status information for a tournament
 * 
 * @param status - Display status or database status
 * @returns TournamentStatusInfo with all styling information
 */
export function getTournamentStatusInfo(status: TournamentDisplayStatus): TournamentStatusInfo {
  // Using theme-aware classes that work in both light and dark mode
  const statusMap: Record<TournamentDisplayStatus, TournamentStatusInfo> = {
    upcoming: {
      status: 'upcoming',
      label: 'Upcoming',
      color: 'var(--status-upcoming)',
      bgClass: 'bg-blue-100 dark:bg-blue-950/30',
      textClass: 'text-blue-600 dark:text-blue-400',
      borderClass: 'border-blue-500 dark:border-blue-600',
      dotColor: 'bg-blue-500',
    },
    live: {
      status: 'live',
      label: 'Live',
      color: 'var(--status-live)',
      bgClass: 'bg-green-100 dark:bg-green-950/30',
      textClass: 'text-green-600 dark:text-green-400',
      borderClass: 'border-green-500 dark:border-green-600',
      dotColor: 'bg-green-500',
    },
    completed: {
      status: 'completed',
      label: 'Completed',
      color: 'var(--status-completed)',
      bgClass: 'bg-gray-100 dark:bg-gray-800',
      textClass: 'text-gray-600 dark:text-gray-400',
      borderClass: 'border-gray-400 dark:border-gray-600',
      dotColor: 'bg-gray-500',
    },
  };

  return statusMap[status];
}

/**
 * Get status from database status field and dates
 * Combines database status with date-based calculation
 * 
 * @param dbStatus - Database status field value
 * @param startDate - Tournament start date
 * @param endDate - Tournament end date
 * @returns TournamentStatusInfo
 */
export function getTournamentStatus(
  dbStatus: string,
  startDate: string | Date,
  endDate: string | Date
): TournamentStatusInfo {
  // If tournament is explicitly marked as completed in DB, trust that
  if (dbStatus === 'COMPLETED') {
    return getTournamentStatusInfo('completed');
  }

  // Otherwise, calculate based on dates
  const calculatedStatus = calculateTournamentStatus(startDate, endDate);
  return getTournamentStatusInfo(calculatedStatus);
}

/**
 * Get status info for admin/internal use (shows more granular statuses)
 * 
 * @param dbStatus - Database status field value
 * @param startDate - Tournament start date
 * @param endDate - Tournament end date
 * @returns TournamentStatusInfo
 */
export function getDetailedTournamentStatus(
  dbStatus: string,
  startDate: string | Date,
  endDate: string | Date
): TournamentStatusInfo {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  // Handle explicit database statuses with theme-aware colors
  if (dbStatus === 'COMPLETED') {
    return {
      status: 'completed',
      label: 'Completed',
      color: 'var(--status-completed)',
      bgClass: 'bg-gray-100 dark:bg-gray-800',
      textClass: 'text-gray-600 dark:text-gray-400',
      borderClass: 'border-gray-400 dark:border-gray-600',
      dotColor: 'bg-gray-500',
    };
  }

  if (dbStatus === 'CANCELLED') {
    return {
      status: 'completed',
      label: 'Cancelled',
      color: 'var(--status-cancelled)',
      bgClass: 'bg-red-100 dark:bg-red-950/30',
      textClass: 'text-red-600 dark:text-red-400',
      borderClass: 'border-red-500 dark:border-red-600',
      dotColor: 'bg-red-500',
    };
  }

  if (dbStatus === 'IN_PROGRESS') {
    return {
      status: 'live',
      label: 'Live Now',
      color: 'var(--status-live)',
      bgClass: 'bg-green-100 dark:bg-green-950/30',
      textClass: 'text-green-600 dark:text-green-400',
      borderClass: 'border-green-500 dark:border-green-600',
      dotColor: 'bg-green-500',
    };
  }

  if (dbStatus === 'BRACKET_GENERATED') {
    return {
      status: 'live',
      label: 'Starting',
      color: 'var(--status-live)',
      bgClass: 'bg-green-100 dark:bg-green-950/30',
      textClass: 'text-green-600 dark:text-green-400',
      borderClass: 'border-green-500 dark:border-green-600',
      dotColor: 'bg-green-500',
    };
  }

  if (dbStatus === 'REGISTRATION_OPEN') {
    // Check if tournament has started
    if (now >= start && now <= end) {
      return {
        status: 'live',
        label: 'Live',
        color: 'var(--status-live)',
        bgClass: 'bg-green-100 dark:bg-green-950/30',
        textClass: 'text-green-600 dark:text-green-400',
        borderClass: 'border-green-500 dark:border-green-600',
        dotColor: 'bg-green-500',
      };
    }
    return {
      status: 'upcoming',
      label: 'Registration Open',
      color: 'var(--status-registration)',
      bgClass: 'bg-amber-100 dark:bg-amber-950/30',
      textClass: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-500 dark:border-amber-600',
      dotColor: 'bg-amber-500',
    };
  }

  if (dbStatus === 'DRAFT') {
    return {
      status: 'upcoming',
      label: 'Draft',
      color: 'var(--status-completed)',
      bgClass: 'bg-gray-100 dark:bg-gray-800',
      textClass: 'text-gray-500 dark:text-gray-400',
      borderClass: 'border-gray-400 dark:border-gray-600',
      dotColor: 'bg-gray-400',
    };
  }

  // Default: calculate based on dates
  return getTournamentStatus(dbStatus, startDate, endDate);
}

/**
 * Status color strip component props
 */
export interface StatusStripProps {
  status: TournamentDisplayStatus;
  className?: string;
}

/**
 * Get status strip gradient classes
 */
export function getStatusStripClasses(status: TournamentDisplayStatus): string {
  const stripMap: Record<TournamentDisplayStatus, string> = {
    upcoming: 'bg-gradient-to-r from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500',
    live: 'bg-gradient-to-r from-green-500 to-green-400 dark:from-green-600 dark:to-green-500',
    completed: 'bg-gradient-to-r from-gray-400 to-gray-300 dark:from-gray-600 dark:to-gray-500',
  };
  return stripMap[status];
}
