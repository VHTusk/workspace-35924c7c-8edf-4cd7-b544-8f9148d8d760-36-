"use client";

import { ReactNode, useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChallengerRestrictionBanner,
  RestrictionType,
} from '@/components/banners/challenger-restriction-banner';
import { useChallengerPermissions } from '@/hooks/use-challenger-permissions';

/**
 * District Permission Wrapper
 * 
 * Wraps action buttons (Join Tournament, Create Challenge, etc.) and checks
 * permissions before allowing the action. Shows appropriate messages if restricted.
 * 
 * Features:
 * - Disables/hides buttons based on permissions
 * - Shows tooltip with restriction message on hover
 * - Optional modal dialog with more detailed information
 * - Supports multiple display modes
 */

export type ChallengerAction = 'join-tournament' | 'create-challenge' | 'accept-challenge';

export interface PermissionWrapperProps {
  /** The action being protected */
  action: ChallengerAction;
  /** The district ID being targeted */
  districtId?: string;
  /** The user's district from their profile */
  userDistrict?: string | null;
  /** Whether user is admin (bypasses restrictions) */
  isAdmin?: boolean;
  /** The sport context for navigation */
  sport?: string;
  /** Child elements (typically buttons) */
  children: ReactNode;
  /** Display mode */
  mode?: 'disable' | 'hide' | 'tooltip' | 'modal';
  /** Show banner above/below content */
  showBanner?: boolean;
  /** Banner position relative to content */
  bannerPosition?: 'above' | 'below';
  /** Custom restriction message */
  customMessage?: string;
  /** Callback when action is attempted while restricted */
  onRestrictedAttempt?: () => void;
  /** Optional className */
  className?: string;
}

const ACTION_LABELS: Record<ChallengerAction, string> = {
  'join-tournament': "Join Tournament",
  'create-challenge': "Create Challenge",
  'accept-challenge': "Accept Challenge",
};

/**
 * Permission wrapper component for Challenger Mode actions
 * 
 * @example
 * ```tsx
 * // Basic usage - disables button if not permitted
 * <ChallengerPermissionWrapper
 *   action="join-tournament"
 *   districtId={districtId}
 *   userDistrict={user?.district}
 *   sport="cornhole"
 * >
 *   <Button>Join Tournament</Button>
 * </ChallengerPermissionWrapper>
 * 
 * // With banner shown below
 * <ChallengerPermissionWrapper
 *   action="create-challenge"
 *   districtId={districtId}
 *   userDistrict={user?.district}
 *   showBanner
 *   bannerPosition="below"
 * >
 *   <Button>Create Challenge</Button>
 * </ChallengerPermissionWrapper>
 * 
 * // Modal mode - shows dialog on click
 * <ChallengerPermissionWrapper
 *   action="accept-challenge"
 *   districtId={districtId}
 *   userDistrict={user?.district}
 *   mode="modal"
 * >
 *   <Button>Accept Challenge</Button>
 * </ChallengerPermissionWrapper>
 * ```
 */
export function ChallengerPermissionWrapper({
  action,
  districtId,
  userDistrict,
  isAdmin = false,
  sport,
  children,
  mode = 'tooltip',
  showBanner = false,
  bannerPosition = 'above',
  customMessage,
  onRestrictedAttempt,
  className,
}: PermissionWrapperProps) {
  const [showModal, setShowModal] = useState(false);

  const permissions = useChallengerPermissions({
    userDistrict,
    targetDistrictId: districtId,
    isAdmin,
  });

  // Determine if action is allowed
  const isAllowed = 
    action === 'join-tournament' ? permissions.canJoinTournament :
    action === 'create-challenge' ? permissions.canCreateChallenge :
    permissions.canAcceptChallenge;

  const restrictionType = permissions.restrictionType as RestrictionType | null;
  const message = customMessage || permissions.restrictionMessage;

  // Handle restricted action attempt
  const handleRestrictedClick = () => {
    onRestrictedAttempt?.();
    if (mode === 'modal' && restrictionType) {
      setShowModal(true);
    }
  };

  // If hiding restricted content
  if (mode === 'hide' && !isAllowed) {
    return null;
  }

  // Banner content
  const banner = showBanner && restrictionType && !isAllowed ? (
    <ChallengerRestrictionBanner
      type={restrictionType}
      sport={sport}
      customMessage={customMessage}
      variant="compact"
    />
  ) : null;

  // Clone children to inject disabled state and tooltip
  const renderChildren = () => {
    if (!isAllowed) {
      // Wrap children with appropriate restriction UI
      const wrappedChildren = (
        <div
          className={cn(
            "relative inline-block",
            mode === 'disable' && "cursor-not-allowed opacity-60"
          )}
          onClick={(e) => {
            if (!isAllowed) {
              e.preventDefault();
              e.stopPropagation();
              handleRestrictedClick();
            }
          }}
        >
          {/* Overlay lock icon for visual feedback */}
          {mode === 'disable' && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <Lock className="h-4 w-4 text-muted-foreground opacity-50" />
            </div>
          )}
          {/* Clone child element with disabled state */}
          {typeof children === 'object' && children !== null && 'type' in children ? (
            // If child is a Button component, add disabled prop
            (() => {
              const childProps = children.props as ButtonProps;
              return (
                <Button
                  {...childProps}
                  disabled={true}
                  className={cn(childProps?.className, "relative")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRestrictedClick();
                  }}
                >
                  {childProps?.children || children}
                </Button>
              );
            })()
          ) : (
            children
          )}
        </div>
      );

      // Wrap with tooltip if enabled
      if (mode === 'tooltip') {
        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                {wrappedChildren}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-sm">{message}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return wrappedChildren;
    }

    // Action is allowed, render children normally
    return children;
  };

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      {banner && bannerPosition === 'above' && banner}
      {renderChildren()}
      {banner && bannerPosition === 'below' && banner}

      {/* Modal for restricted attempts */}
      <AlertDialog open={showModal} onOpenChange={setShowModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Action Not Available
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {restrictionType === 'no-district' ? (
              <>You need to add your district to your profile before you can {ACTION_LABELS[action].toLowerCase()} in Challenger Mode.</>
            ) : (
              <>You can only {ACTION_LABELS[action].toLowerCase()} in your own district. Navigate to your district to participate.</>
            )}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowModal(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Simplified HOC-style wrapper for quick permission checks
 * Returns the children if permitted, null otherwise
 */
export function PermissionGuard({
  action,
  districtId,
  userDistrict,
  isAdmin,
  children,
  fallback,
}: {
  action: ChallengerAction;
  districtId?: string;
  userDistrict?: string | null;
  isAdmin?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const permissions = useChallengerPermissions({
    userDistrict,
    targetDistrictId: districtId,
    isAdmin,
  });

  const isAllowed =
    action === 'join-tournament' ? permissions.canJoinTournament :
    action === 'create-challenge' ? permissions.canCreateChallenge :
    permissions.canAcceptChallenge;

  if (!isAllowed) {
    return fallback || null;
  }

  return children;
}

/**
 * Hook-style permission check component
 * Renders different content based on permission state
 */
export function PermissionSwitch({
  action,
  districtId,
  userDistrict,
  isAdmin,
  children,
  restricted,
}: {
  action: ChallengerAction;
  districtId?: string;
  userDistrict?: string | null;
  isAdmin?: boolean;
  children: ReactNode;
  restricted?: ReactNode;
}) {
  const permissions = useChallengerPermissions({
    userDistrict,
    targetDistrictId: districtId,
    isAdmin,
  });

  const isAllowed =
    action === 'join-tournament' ? permissions.canJoinTournament :
    action === 'create-challenge' ? permissions.canCreateChallenge :
    permissions.canAcceptChallenge;

  return isAllowed ? children : restricted;
}

export default ChallengerPermissionWrapper;
