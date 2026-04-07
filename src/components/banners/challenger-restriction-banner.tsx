"use client";

import { AlertCircle, MapPin, Eye, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Challenger Restriction Banner
 * 
 * Displays restriction messages when users try to perform actions
 * they don't have permission for in Challenger Mode.
 * 
 * Two variants:
 * 1. "no-district" - User hasn't selected a district
 * 2. "other-district" - User is viewing a different district (view-only mode)
 */

export type RestrictionType = 'no-district' | 'other-district';

export interface ChallengerRestrictionBannerProps {
  /** Type of restriction being displayed */
  type: RestrictionType;
  /** The sport context for navigation (e.g., 'cornhole', 'darts') */
  sport?: string;
  /** Optional custom message to override default */
  customMessage?: string;
  /** Whether to show action button */
  showAction?: boolean;
  /** Optional CSS class for styling */
  className?: string;
  /** Compact variant for inline use */
  variant?: 'full' | 'compact' | 'inline';
  /** Callback when action is clicked (for custom handling) */
  onActionClick?: () => void;
}

const DEFAULT_MESSAGES: Record<RestrictionType, string> = {
  'no-district': "Add your district in your profile to participate in Challenger Mode.",
  'other-district': "View Only — Challenger participation is limited to your district.",
};

const ACTION_CONFIG: Record<RestrictionType, { label: string; href: string; icon: typeof MapPin }> = {
  'no-district': {
    label: "Add District",
    href: "/profile", // Will be prefixed with sport
    icon: UserPlus,
  },
  'other-district': {
    label: "Go to My District",
    href: "/dashboard/district", // Will be prefixed with sport
    icon: MapPin,
  },
};

/**
 * Banner component for displaying Challenger Mode restrictions
 * 
 * @example
 * ```tsx
 * // Full banner with action
 * <ChallengerRestrictionBanner type="no-district" sport="cornhole" />
 * 
 * // Compact inline variant
 * <ChallengerRestrictionBanner type="other-district" variant="compact" />
 * 
 * // With custom action handler
 * <ChallengerRestrictionBanner 
 *   type="no-district" 
 *   onActionClick={() => router.push('/profile')} 
 * />
 * ```
 */
export function ChallengerRestrictionBanner({
  type,
  sport,
  customMessage,
  showAction = true,
  className,
  variant = 'full',
  onActionClick,
}: ChallengerRestrictionBannerProps) {
  const message = customMessage || DEFAULT_MESSAGES[type];
  const actionConfig = ACTION_CONFIG[type];
  const Icon = type === 'no-district' ? AlertCircle : Eye;
  const actionHref = sport ? `/${sport}${actionConfig.href}` : actionConfig.href;
  const ActionIcon = actionConfig.icon;

  // Inline variant - minimal styling for inline text
  if (variant === 'inline') {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        type === 'no-district' 
          ? "text-amber-600 dark:text-amber-400" 
          : "text-blue-600 dark:text-blue-400",
        className
      )}>
        <Icon className="h-3.5 w-3.5" />
        <span>{message}</span>
        {showAction && type === 'no-district' && (
          <Link 
            href={actionHref}
            className="underline underline-offset-2 hover:no-underline font-medium"
          >
            Add now
          </Link>
        )}
      </span>
    );
  }

  // Compact variant - smaller banner
  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
        type === 'no-district'
          ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
          : "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
        className
      )}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{message}</span>
        {showAction && (
          onActionClick ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onActionClick}
              className="h-7 text-xs font-medium"
            >
              <ActionIcon className="h-3.5 w-3.5 mr-1" />
              {actionConfig.label}
            </Button>
          ) : (
            <Link href={actionHref}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-medium"
              >
                <ActionIcon className="h-3.5 w-3.5 mr-1" />
                {actionConfig.label}
              </Button>
            </Link>
          )
        )}
      </div>
    );
  }

  // Full variant - default full-width banner
  return (
    <div className={cn(
      "w-full p-4 rounded-lg border",
      type === 'no-district'
        ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800"
        : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800",
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Icon and Message */}
        <div className="flex items-start gap-3 flex-1">
          <div className={cn(
            "p-2 rounded-full shrink-0",
            type === 'no-district'
              ? "bg-amber-100 dark:bg-amber-900/50"
              : "bg-blue-100 dark:bg-blue-900/50"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              type === 'no-district'
                ? "text-amber-600 dark:text-amber-400"
                : "text-blue-600 dark:text-blue-400"
            )} />
          </div>
          <div className="space-y-1">
            <p className={cn(
              "font-medium",
              type === 'no-district'
                ? "text-amber-800 dark:text-amber-200"
                : "text-blue-800 dark:text-blue-200"
            )}>
              {type === 'no-district' ? "District Required" : "View Only Mode"}
            </p>
            <p className={cn(
              "text-sm",
              type === 'no-district'
                ? "text-amber-700 dark:text-amber-300"
                : "text-blue-700 dark:text-blue-300"
            )}>
              {message}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {showAction && (
          <div className="flex-shrink-0">
            {onActionClick ? (
              <Button
                variant={type === 'no-district' ? 'default' : 'outline'}
                size="sm"
                onClick={onActionClick}
                className={cn(
                  type === 'no-district' 
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                )}
              >
                <ActionIcon className="h-4 w-4 mr-2" />
                {actionConfig.label}
              </Button>
            ) : (
              <Link href={actionHref}>
                <Button
                  variant={type === 'no-district' ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    type === 'no-district' 
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                  )}
                >
                  <ActionIcon className="h-4 w-4 mr-2" />
                  {actionConfig.label}
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple inline restriction message for use in buttons or tooltips
 */
export function ChallengerRestrictionMessage({ 
  type,
  className,
}: {
  type: RestrictionType;
  className?: string;
}) {
  return (
    <span className={cn(
      "text-xs font-medium",
      type === 'no-district'
        ? "text-amber-600 dark:text-amber-400"
        : "text-blue-600 dark:text-blue-400",
      className
    )}>
      {type === 'no-district' ? "District required" : "View only"}
    </span>
  );
}

export default ChallengerRestrictionBanner;
