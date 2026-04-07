"use client";

import { useCallback, type ReactElement } from "react";
import { ProfileCompletionBanner } from "./profile-completion-banner";
import { EmailVerificationBanner } from "./email-verification-banner";
import { PhoneVerificationBanner } from "./phone-verification-banner";
import { cn } from "@/lib/utils";

export interface BannerManagerProps {
  emailVerified: boolean;
  phoneVerified: boolean;
  profileComplete: boolean;
  onVerifyEmail: () => void;
  onVerifyPhone: () => void;
  onCompleteProfile: () => void;
  className?: string;
  showDismiss?: boolean;
  maxVisible?: number;
}

/**
 * Banner Manager Component
 * 
 * Manages display priority and stacking of multiple reminder banners.
 * Priority order: Email Verification > Phone Verification > Profile Completion
 * 
 * Features:
 * - Clean stacked layout (max 3 banners visible by default)
 * - Consistent styling across banners
 * - Animation on mount
 * - Proper spacing between banners
 * - Theme-aware (light/dark mode)
 * - Responsive for mobile and desktop
 */
export function BannerManager({
  emailVerified,
  phoneVerified,
  profileComplete,
  onVerifyEmail,
  onVerifyPhone,
  onCompleteProfile,
  className,
  showDismiss = true,
  maxVisible = 3,
}: BannerManagerProps) {
  // Memoize handlers to prevent unnecessary re-renders
  const handleVerifyEmail = useCallback(() => {
    onVerifyEmail();
  }, [onVerifyEmail]);

  const handleVerifyPhone = useCallback(() => {
    onVerifyPhone();
  }, [onVerifyPhone]);

  const handleCompleteProfile = useCallback(() => {
    onCompleteProfile();
  }, [onCompleteProfile]);

  // Build banners array based on verification status
  // Priority order: Email > Phone > Profile
  const banners: ReactElement[] = [];

  if (!emailVerified) {
    banners.push(
      <EmailVerificationBanner
        key="email-verification"
        onVerifyEmail={handleVerifyEmail}
        showDismiss={showDismiss}
      />
    );
  }

  if (!phoneVerified) {
    banners.push(
      <PhoneVerificationBanner
        key="phone-verification"
        onVerifyPhone={handleVerifyPhone}
        showDismiss={showDismiss}
      />
    );
  }

  if (!profileComplete) {
    banners.push(
      <ProfileCompletionBanner
        key="profile-completion"
        onCompleteProfile={handleCompleteProfile}
        showDismiss={showDismiss}
      />
    );
  }

  // If all verified or no banners to show, return null
  if (banners.length === 0) {
    return null;
  }

  // Limit visible banners
  const visibleBanners = banners.slice(0, maxVisible);

  return (
    <div
      className={cn(
        "w-full",
        "space-y-2",
        // Ensure banners don't break page layout
        "flex-shrink-0",
        className
      )}
      role="region"
      aria-label="Reminder banners"
    >
      {visibleBanners}
    </div>
  );
}

/**
 * Hook to clear dismissed banner states
 * Useful for testing or resetting banner visibility
 */
export function clearAllBannerDismissals() {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem("valorhive_banner_profile_completion_dismissed");
  localStorage.removeItem("valorhive_banner_email_verification_dismissed");
  localStorage.removeItem("valorhive_banner_phone_verification_dismissed");
}

/**
 * Hook to check if a specific banner is dismissed
 */
export function isBannerDismissed(bannerType: "profile" | "email" | "phone"): boolean {
  if (typeof window === "undefined") return false;
  
  const keys = {
    profile: "valorhive_banner_profile_completion_dismissed",
    email: "valorhive_banner_email_verification_dismissed",
    phone: "valorhive_banner_phone_verification_dismissed",
  };
  
  return localStorage.getItem(keys[bannerType]) === "true";
}
