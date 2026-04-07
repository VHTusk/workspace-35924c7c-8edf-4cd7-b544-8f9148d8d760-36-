"use client";

import { useState, useLayoutEffect } from "react";
import { Mail, X, ChevronRight, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "valorhive_banner_email_verification_dismissed";

interface EmailVerificationBannerProps {
  onVerifyEmail: () => void;
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

export function EmailVerificationBanner({
  onVerifyEmail,
  className,
  showDismiss = true,
}: EmailVerificationBannerProps) {
  // Initialize visibility based on localStorage (client-side only)
  const [isVisible, setIsVisible] = useState(!getIsDismissed());
  const [isAnimating, setIsAnimating] = useState(false);
  const [isResending, setIsResending] = useState(false);

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

  const handleClick = async () => {
    setIsResending(true);
    try {
      await onVerifyEmail();
    } finally {
      setTimeout(() => {
        setIsResending(false);
      }, 2000);
    }
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
          "bg-gradient-to-r from-blue-50 to-sky-50",
          "border-blue-200",
          "dark:from-blue-950/60 dark:to-sky-950/40",
          "dark:border-blue-700/50",
          "hover:from-blue-100 hover:to-sky-100",
          "dark:hover:from-blue-900/70 dark:hover:to-sky-900/50",
          "transition-colors duration-200"
        )}
        onClick={handleClick}
      >
        <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="flex items-center justify-between w-full pr-8">
          <span className="text-blue-800 dark:text-blue-200 font-medium text-sm sm:text-base">
            Please verify your email address to secure your account.
          </span>
          <div className="hidden sm:flex items-center gap-2">
            {isResending ? (
              <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
            )}
          </div>
        </AlertDescription>
        {showDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2",
              "h-6 w-6 rounded-full",
              "text-blue-600 hover:text-blue-800",
              "dark:text-blue-400 dark:hover:text-blue-200",
              "hover:bg-blue-200/50 dark:hover:bg-blue-800/50",
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
