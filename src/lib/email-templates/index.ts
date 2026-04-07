/**
 * Email Templates Index
 * 
 * Exports all email template components for VALORHIVE
 */

export { TournamentConfirmationEmail, type TournamentConfirmationData } from './tournament-confirmation';
export { MatchReminderEmail, type MatchReminderData } from './match-reminder';
export { ResultNotificationEmail, type ResultNotificationData } from './result-notification';
export { WelcomeEmail, type WelcomeEmailData } from './welcome';
export { RefundNotificationEmail, type RefundNotificationData } from './refund-notification';

// Re-export from main email-templates.ts for convenience
export {
  // Named export functions
  generateTournamentConfirmationEmail,
  generateMatchReminderEmail,
  generateResultEmail,
  generateWelcomeEmail,
  generatePasswordResetEmail,
  generateSubscriptionEmail,
  // Existing templates
  getTournamentReminderEmail,
  getMatchResultEmail,
  getTournamentRecapEmail,
  getRegistrationConfirmEmail,
  getWeeklyDigestEmail,
  getMilestoneEmail,
  getSubscriptionExpiryEmail,
  getSubscriptionEmail,
  // Types
  type EmailTemplateData,
  type TournamentReminderData,
  type MatchResultData,
  type TournamentRecapData,
  type RegistrationConfirmData,
  type WeeklyDigestData,
  type MilestoneData,
  type SubscriptionExpiryData,
  type SubscriptionData,
} from '../email-templates';

// Template registry for easy access
export const EmailTemplateRegistry = {
  tournamentConfirmation: 'tournament-confirmation',
  matchReminder: 'match-reminder',
  resultNotification: 'result-notification',
  welcome: 'welcome',
  refundNotification: 'refund-notification',
  passwordReset: 'password-reset',
  subscription: 'subscription',
  tournamentRecap: 'tournament-recap',
  weeklyDigest: 'weekly-digest',
  milestone: 'milestone',
  subscriptionExpiry: 'subscription-expiry',
} as const;

export type EmailTemplateName = typeof EmailTemplateRegistry[keyof typeof EmailTemplateRegistry];
