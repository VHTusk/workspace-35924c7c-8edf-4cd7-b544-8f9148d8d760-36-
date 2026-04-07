"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Bell,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// SSR-safe localStorage read
function getDismissedFromStorage(tournamentId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`spectator-banner-dismissed-${tournamentId}`) === "true";
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

interface SpectatorModeIndicatorProps {
  tournamentId: string;
  tournamentName: string;
  isRegistered?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
  onRegister?: () => void;
}

export function SpectatorModeIndicator({
  tournamentId,
  tournamentName,
  isRegistered = false,
  isFollowing = false,
  onFollow,
  onRegister,
}: SpectatorModeIndicatorProps) {
  const params = useParams();
  const sport = params?.sport as string || "cornhole";
  const isCornhole = sport === "cornhole";
  const primaryClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  // Use useSyncExternalStore for SSR-safe localStorage reading
  const dismissed = useSyncExternalStore(
    subscribe,
    () => getDismissedFromStorage(tournamentId),
    () => false // Server snapshot
  );

  const [localIsFollowing, setLocalIsFollowing] = useState(isFollowing);

  const handleDismiss = () => {
    const dismissedKey = `spectator-banner-dismissed-${tournamentId}`;
    localStorage.setItem(dismissedKey, "true");
    // Dispatch storage event to notify other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: dismissedKey,
      newValue: "true"
    }));
  };

  if (dismissed || isRegistered) {
    return null;
  }

  return (
    <Card className={cn(
      "border-2",
      isCornhole ? "border-green-500/30 bg-green-50/50" : "border-teal-500/30 bg-teal-50/50"
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              isCornhole ? "bg-green-100" : "bg-teal-100"
            )}>
              <Eye className={cn("h-5 w-5", primaryTextClass)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Spectator Mode</span>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  isCornhole ? "border-green-300 text-green-600" : "border-teal-300 text-teal-600"
                )}>
                  Viewing Only
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;re viewing as a spectator. {localIsFollowing ? "You'll receive updates." : "Follow to get notified!"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!localIsFollowing && (
              <Button
                size="sm"
                onClick={() => {
                  if (onFollow) {
                    onFollow();
                    setLocalIsFollowing(true);
                  }
                }}
                className={cn(primaryClass, "text-white")}
              >
                <Bell className="h-4 w-4 mr-1" />
                Follow
              </Button>
            )}
            {onRegister && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRegister}
                className={cn(
                  "gap-1",
                  isCornhole ? "border-green-300 text-green-600 hover:bg-green-50" : "border-teal-300 text-teal-600 hover:bg-teal-50"
                )}
              >
                <UserPlus className="h-4 w-4" />
                Register to Play
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact spectator badge for headers/nav
 */
export function SpectatorBadge({ isFollowing }: { isFollowing?: boolean }) {
  return (
    <Badge variant="outline" className="gap-1 bg-muted/50">
      <Eye className="h-3 w-3" />
      Spectator
      {isFollowing && (
        <Bell className="h-3 w-3 text-green-500" />
      )}
    </Badge>
  );
}
