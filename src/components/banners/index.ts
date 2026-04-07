/**
 * VALORHIVE Reminder Banners
 * 
 * Reusable banner components for user action reminders.
 * 
 * Components:
 * - ProfileCompletionBanner: Reminds users to complete their profile
 * - EmailVerificationBanner: Prompts email verification
 * - PhoneVerificationBanner: Prompts phone verification
 * - BannerManager: Manages display priority and stacking of banners
 * - ChallengerRestrictionBanner: Shows Challenger Mode district restrictions
 * 
 * Features:
 * - Theme-aware (light/dark mode)
 * - Responsive for mobile and desktop
 * - Animated on mount
 * - Dismissible with localStorage persistence
 * - Proper contrast in both themes
 */

export { ProfileCompletionBanner } from "./profile-completion-banner";
export { EmailVerificationBanner } from "./email-verification-banner";
export { PhoneVerificationBanner } from "./phone-verification-banner";
export { 
  BannerManager,
  clearAllBannerDismissals,
  isBannerDismissed,
  type BannerManagerProps 
} from "./banner-manager";
export {
  ChallengerRestrictionBanner,
  ChallengerRestrictionMessage,
  type RestrictionType,
  type ChallengerRestrictionBannerProps,
} from "./challenger-restriction-banner";
