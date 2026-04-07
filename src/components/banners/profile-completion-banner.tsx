"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { User, X, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "valorhive_banner_profile_completion_dismissed";

interface ProfileCompletionBannerProps {
  onCompleteProfile: () => void;
  className?: string;
  showDismiss?: boolean;
}

/**
 * Helper to check if banner was dismissed
 * Returns false (not dismissed) on server-side
 */
function getIsDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function ProfileCompletionBanner({
  onCompleteProfile,
  className,
  showDismiss = true,
}: ProfileCompletionBannerProps) {
  // Initialize visibility based on localStorage (client-side only)
  const [isVisible, setIsVisible] = useState(!getIsDismissed());
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation after initial mount using useLayoutEffect for smooth animation
  useLayoutEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame for smooth animation trigger
      const frame = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [isVisible]);

  const handleDismiss = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }, 300);
  };

  const handleClick = () => {
    onCompleteProfile();
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out",
        isAnimating
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2",
        className
      )}
    >
      <Alert
        className={cn(
          "relative cursor-pointer group",
          "bg-gradient-to-r from-amber-50 to-yellow-50",
          "border-amber-200",
          "dark:from-amber-950/60 dark:to-yellow-950/40",
          "dark:border-amber-700/50",
          "hover:from-amber-100 hover:to-yellow-100",
          "dark:hover:from-amber-900/70 dark:hover:to-yellow-900/50",
          "transition-colors duration-200"
        )}
        onClick={handleClick}
      >
        <User className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="flex items-center justify-between w-full pr-8">
          <span className="text-amber-800 dark:text-amber-200 font-medium text-sm sm:text-base">
            Complete your profile to unlock full platform features.
          </span>
          <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400 hidden sm:block group-hover:translate-x-1 transition-transform" />
        </AlertDescription>
        {showDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2",
              "h-6 w-6 rounded-full",
              "text-amber-600 hover:text-amber-800",
              "dark:text-amber-400 dark:hover:text-amber-200",
              "hover:bg-amber-200/50 dark:hover:bg-amber-800/50",
              "transition-colors"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </Alert>
    </div>
  );
}
