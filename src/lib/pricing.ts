/**
 * VALORHIVE Pricing Configuration
 * 
 * SINGLE SOURCE OF TRUTH for all pricing across the platform.
 * All amounts are in PAISE (1 Rupee = 100 paise).
 * 
 * NEVER define prices anywhere else. Always import from this file.
 * 
 * @module pricing
 */

/**
 * Money type alias - all monetary values are in paise (minor units)
 * This prevents floating-point errors and ensures consistency
 */
export type MoneyMinor = number;

/**
 * Centralized pricing configuration
 * All values in paise (₹1 = 100 paise)
 */
export const PRICING = {
  // ==========================================
  // PLAYER SUBSCRIPTIONS
  // ==========================================
  /** Player yearly subscription: ₹1,200/year per sport */
  PLAYER_SUBSCRIPTION_YEARLY: 120000,  // ₹1,200 in paise
  
  /** Player monthly equivalent (for display): ₹100/month */
  PLAYER_SUBSCRIPTION_MONTHLY_EQUIV: 10000,
  
  // ==========================================
  // ORGANIZATION SUBSCRIPTIONS
  // ==========================================
  /** School/Club organization: ₹15,000/year per sport */
  ORG_SCHOOL_CLUB_YEARLY: 1500000,
  
  /** Corporate organization: ₹1,00,000/year per sport */
  ORG_CORPORATE_YEARLY: 10000000,
  
  /** Academy organization: ₹25,000/year per sport */
  ORG_ACADEMY_YEARLY: 2500000,
  
  /** Association organization: ₹50,000/year per sport */
  ORG_ASSOCIATION_YEARLY: 5000000,
  
  /** Government organization: ₹10,000/year per sport */
  ORG_GOVT_YEARLY: 1000000,
  
  // ==========================================
  // TOURNAMENT FEES
  // ==========================================
  /** Default tournament entry fee: ₹500 */
  TOURNAMENT_ENTRY_FEE_DEFAULT: 50000,
  
  /** Inter-organization tournament fee: ₹5,000 */
  INTER_ORG_TOURNAMENT_FEE: 500000,
  
  /** Minimum tournament entry fee: ₹100 */
  TOURNAMENT_ENTRY_FEE_MIN: 10000,
  
  /** Maximum tournament entry fee: ₹10,000 */
  TOURNAMENT_ENTRY_FEE_MAX: 1000000,
  
  // ==========================================
  // PLATFORM FEES
  // ==========================================
  /** Platform fee percentage on tournament entries: 5% */
  PLATFORM_FEE_PERCENT: 5,
  
  /** Processing fee (fixed): ₹10 */
  PROCESSING_FEE_FIXED: 1000,
  
  /** PG fee percentage (Razorpay): 2% */
  PG_FEE_PERCENT: 2,
  
  // ==========================================
  // REFUND POLICY
  // ==========================================
  /** Refund before reg deadline: 100% */
  REFUND_BEFORE_REG_DEADLINE_PERCENT: 100,
  
  /** Refund after reg deadline, before start: 100% */
  REFUND_AFTER_REG_BEFORE_START_PERCENT: 100,
  
  /** Refund during tournament: 50% */
  REFUND_DURING_TOURNAMENT_PERCENT: 50,
  
  /** Refund after completion: 0% */
  REFUND_AFTER_COMPLETION_PERCENT: 0,
  
  // ==========================================
  // PRIZE DISTRIBUTION
  // ==========================================
  /** First place prize share: 50% */
  PRIZE_FIRST_PLACE_PERCENT: 50,
  
  /** Second place prize share: 30% */
  PRIZE_SECOND_PLACE_PERCENT: 30,
  
  /** Third place prize share: 20% */
  PRIZE_THIRD_PLACE_PERCENT: 20,
  
  // ==========================================
  // EARLY BIRD & DISCOUNTS
  // ==========================================
  /** Early bird discount: 10% */
  EARLY_BIRD_DISCOUNT_PERCENT: 10,
  
  /** Group discount (min 5 players): 5% */
  GROUP_DISCOUNT_PERCENT: 5,
  
  /** Minimum players for group discount */
  GROUP_DISCOUNT_MIN_PLAYERS: 5,
  
  // ==========================================
  // WALLET LIMITS
  // ==========================================
  /** Minimum wallet balance: ₹0 */
  WALLET_MIN_BALANCE: 0,
  
  /** Maximum wallet balance: ₹50,000 */
  WALLET_MAX_BALANCE: 5000000,
  
  /** Minimum withdrawal: ₹100 */
  WITHDRAWAL_MIN: 10000,
  
  // ==========================================
  // REFERRAL BONUS
  // ==========================================
  /** Referrer bonus: ₹50 */
  REFERRAL_BONUS_REFERRER: 5000,
  
  /** Referee bonus: ₹50 */
  REFERRAL_BONUS_REFEREE: 5000,

} as const;

export type PricingConfig = {
  [K in keyof typeof PRICING]: number;
};

/**
 * Payment types for tracking
 */
export type PaymentType = 
  | 'PLAYER_SUBSCRIPTION'
  | 'ORG_SUBSCRIPTION_SCHOOL_CLUB'
  | 'ORG_SUBSCRIPTION_CORPORATE'
  | 'ORG_SUBSCRIPTION_ACADEMY'
  | 'ORG_SUBSCRIPTION_ASSOCIATION'
  | 'ORG_SUBSCRIPTION_GOVT'
  | 'TOURNAMENT_ENTRY'
  | 'INTER_ORG_TOURNAMENT_ENTRY'
  | 'WALLET_TOPUP';

/**
 * Get amount for payment type
 */
export function getPaymentTypeAmount(type: PaymentType): MoneyMinor {
  switch (type) {
    case 'PLAYER_SUBSCRIPTION':
      return PRICING.PLAYER_SUBSCRIPTION_YEARLY;
    case 'ORG_SUBSCRIPTION_SCHOOL_CLUB':
      return PRICING.ORG_SCHOOL_CLUB_YEARLY;
    case 'ORG_SUBSCRIPTION_CORPORATE':
      return PRICING.ORG_CORPORATE_YEARLY;
    case 'ORG_SUBSCRIPTION_ACADEMY':
      return PRICING.ORG_ACADEMY_YEARLY;
    case 'ORG_SUBSCRIPTION_ASSOCIATION':
      return PRICING.ORG_ASSOCIATION_YEARLY;
    case 'ORG_SUBSCRIPTION_GOVT':
      return PRICING.ORG_GOVT_YEARLY;
    case 'TOURNAMENT_ENTRY':
      return PRICING.TOURNAMENT_ENTRY_FEE_DEFAULT;
    case 'INTER_ORG_TOURNAMENT_ENTRY':
      return PRICING.INTER_ORG_TOURNAMENT_FEE;
    case 'WALLET_TOPUP':
      return 0; // Variable amount
    default:
      return 0;
  }
}

/**
 * Convert paise to rupees (for display)
 */
export function toRupees(paise: MoneyMinor): number {
  return paise / 100;
}

/**
 * Convert rupees to paise (for storage)
 */
export function toPaise(rupees: number): MoneyMinor {
  return Math.round(rupees * 100);
}

/**
 * Format money for display (e.g., "₹1,200")
 */
export function formatMoney(paise: MoneyMinor): string {
  const rupees = toRupees(paise);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Format money with decimals (e.g., "₹1,200.00")
 */
export function formatMoneyPrecise(paise: MoneyMinor): string {
  const rupees = toRupees(paise);
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculate platform fee for a tournament entry
 */
export function calculatePlatformFee(entryFeePaise: MoneyMinor): {
  platformFee: MoneyMinor;
  pgFee: MoneyMinor;
  processingFee: MoneyMinor;
  totalFees: MoneyMinor;
  netAmount: MoneyMinor;
} {
  const platformFee = Math.round(entryFeePaise * PRICING.PLATFORM_FEE_PERCENT / 100);
  const pgFee = Math.round(entryFeePaise * PRICING.PG_FEE_PERCENT / 100);
  const processingFee = PRICING.PROCESSING_FEE_FIXED;
  const totalFees = platformFee + pgFee + processingFee;
  const netAmount = entryFeePaise - totalFees;
  
  return {
    platformFee,
    pgFee,
    processingFee,
    totalFees,
    netAmount: Math.max(0, netAmount),
  };
}

/**
 * Validate that an amount is in valid paise format
 */
export function isValidPaise(amount: unknown): amount is MoneyMinor {
  return (
    typeof amount === 'number' &&
    Number.isInteger(amount) &&
    amount >= 0
  );
}

/**
 * Get pricing from environment variables (with fallback to constants)
 * This allows runtime overrides for testing/deployment
 */
export function getPricingFromEnv(): PricingConfig {
  return {
    ...PRICING,
    PLAYER_SUBSCRIPTION_YEARLY: parseInt(process.env.PLAYER_SUBSCRIPTION_YEARLY || String(PRICING.PLAYER_SUBSCRIPTION_YEARLY)),
    ORG_SCHOOL_CLUB_YEARLY: parseInt(process.env.ORG_SCHOOL_CLUB_YEARLY || String(PRICING.ORG_SCHOOL_CLUB_YEARLY)),
    ORG_CORPORATE_YEARLY: parseInt(process.env.ORG_CORPORATE_YEARLY || String(PRICING.ORG_CORPORATE_YEARLY)),
    TOURNAMENT_ENTRY_FEE_DEFAULT: parseInt(process.env.TOURNAMENT_ENTRY_FEE || String(PRICING.TOURNAMENT_ENTRY_FEE_DEFAULT)),
    INTER_ORG_TOURNAMENT_FEE: parseInt(process.env.INTER_ORG_TOURNAMENT_FEE || String(PRICING.INTER_ORG_TOURNAMENT_FEE)),
  };
}

// ==========================================
// BULK PRICING
// ==========================================

/**
 * Bulk pricing tiers for institutions
 */
export const BULK_PRICING_TIERS = [
  { minParticipants: 10, maxParticipants: 24, discountPercent: 5, pricePerPlayer: 142500 },   // 5% off
  { minParticipants: 25, maxParticipants: 49, discountPercent: 10, pricePerPlayer: 135000 },  // 10% off
  { minParticipants: 50, maxParticipants: 99, discountPercent: 15, pricePerPlayer: 127500 },  // 15% off
  { minParticipants: 100, maxParticipants: 199, discountPercent: 20, pricePerPlayer: 120000 }, // 20% off
  { minParticipants: 200, maxParticipants: 499, discountPercent: 25, pricePerPlayer: 112500 }, // 25% off
  { minParticipants: 500, maxParticipants: Infinity, discountPercent: 30, pricePerPlayer: 105000 }, // 30% off
] as const;

/**
 * Bulk pricing result type
 */
export interface BulkPricingResult {
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  tier: typeof BULK_PRICING_TIERS[number] | null;
}

/**
 * Calculate bulk pricing for a given number of participants
 */
export function calculateBulkPrice(participantCount: number): BulkPricingResult {
  const basePrice = PRICING.PLAYER_SUBSCRIPTION_YEARLY;
  const originalPrice = basePrice * participantCount;
  
  // Find applicable tier
  const tier = BULK_PRICING_TIERS.find(
    t => participantCount >= t.minParticipants && participantCount <= t.maxParticipants
  ) || null;
  
  if (!tier) {
    return {
      originalPrice,
      discountedPrice: originalPrice,
      savings: 0,
      tier: null,
    };
  }
  
  const discountedPrice = tier.pricePerPlayer * participantCount;
  const savings = originalPrice - discountedPrice;
  
  return {
    originalPrice,
    discountedPrice,
    savings,
    tier,
  };
}

export default PRICING;
