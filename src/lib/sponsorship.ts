/**
 * Tournament Sponsorship Marketplace
 * 
 * Connects sponsors with tournaments for visibility
 * India market focused
 */

import { db } from '@/lib/db';

// ============================================
// Types
// ============================================

export type SponsorTier = 'title' | 'gold' | 'silver' | 'bronze';
export type SponsorshipStatus = 'available' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface SponsorshipPackage {
  tier: SponsorTier;
  name: string;
  priceMin: number;
  priceMax: number;
  benefits: string[];
  visibilityScore: number; // 1-10
  recommended: boolean;
}

export interface TournamentSponsorship {
  id: string;
  tournamentId: string;
  tournamentName: string;
  sponsorId?: string;
  sponsorName?: string;
  tier: SponsorTier;
  amount: number;
  status: SponsorshipStatus;
  benefits: string[];
  createdAt: Date;
  confirmedAt?: Date;
}

export interface SponsorProfile {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  description: string;
  industry: string;
  contactEmail: string;
  contactPhone?: string;
  totalSponsorships: number;
  totalSpent: number;
}

// ============================================
// Sponsorship Tiers
// ============================================

export const SPONSORSHIP_TIERS: Record<SponsorTier, SponsorshipPackage> = {
  title: {
    tier: 'title',
    name: 'Title Sponsor',
    priceMin: 50000,
    priceMax: 500000,
    benefits: [
      'Tournament named after brand (e.g., "Brand X Championship")',
      'Logo on all tournament communications',
      'Logo on bracket page (prime position)',
      'Logo on player certificates',
      'Social media mentions (5+ posts)',
      'Booth space at venue',
      'Right to use "Official Sponsor" in marketing',
      'Mention in press releases',
    ],
    visibilityScore: 10,
    recommended: false,
  },
  gold: {
    tier: 'gold',
    name: 'Gold Sponsor',
    priceMin: 25000,
    priceMax: 100000,
    benefits: [
      'Logo on all tournament communications',
      'Logo on bracket page (prominent)',
      'Logo on player certificates',
      'Social media mentions (3+ posts)',
      'Booth space at venue',
      'Right to use "Official Sponsor" in marketing',
    ],
    visibilityScore: 7,
    recommended: true,
  },
  silver: {
    tier: 'silver',
    name: 'Silver Sponsor',
    priceMin: 10000,
    priceMax: 50000,
    benefits: [
      'Logo on bracket page',
      'Social media mentions (2+ posts)',
      'Logo on player certificates',
      'Mention in thank-you email',
    ],
    visibilityScore: 5,
    recommended: false,
  },
  bronze: {
    tier: 'bronze',
    name: 'Bronze Sponsor',
    priceMin: 5000,
    priceMax: 25000,
    benefits: [
      'Logo on bracket page',
      'Mention in thank-you email',
      'Social media mention (1 post)',
    ],
    visibilityScore: 3,
    recommended: false,
  },
};

// ============================================
// Industries for Sponsors
// ============================================

export const SPONSOR_INDUSTRIES = [
  'Sports & Fitness',
  'Food & Beverage',
  'Technology',
  'Banking & Finance',
  'Real Estate',
  'Automotive',
  'Healthcare',
  'Education',
  'Entertainment',
  'Retail',
  'FMCG',
  'Telecommunications',
  'Travel & Hospitality',
  'Other',
] as const;

// ============================================
// API Functions
// ============================================

/**
 * Get available sponsorship opportunities
 */
export async function getAvailableSponsorships(filters?: {
  sport?: string;
  scope?: string;
  minDate?: Date;
  maxDate?: Date;
}): Promise<TournamentSponsorship[]> {
  try {
    // Get tournaments that are open for sponsorship
    const tournaments = await db.$queryRaw<Array<{
      id: string;
      name: string;
      sport: string;
      scope: string;
      startDate: Date;
      expectedParticipants: number;
    }>>`
      SELECT 
        t.id, 
        t.name, 
        t.sport, 
        t.scope, 
        t.startDate,
        (SELECT COUNT(*) FROM TournamentRegistration WHERE tournamentId = t.id) as expectedParticipants
      FROM Tournament t
      WHERE t.status IN ('DRAFT', 'REGISTRATION_OPEN')
        AND t.startDate > ${new Date()}
        ${filters?.sport ? `AND t.sport = ${filters.sport}` : ''}
        ${filters?.scope ? `AND t.scope = ${filters.scope}` : ''}
        ${filters?.minDate ? `AND t.startDate >= ${filters.minDate}` : ''}
        ${filters?.maxDate ? `AND t.startDate <= ${filters.maxDate}` : ''}
      ORDER BY t.startDate ASC
    `;
    
    return tournaments.map(t => ({
      id: `sponsorship_${t.id}`,
      tournamentId: t.id,
      tournamentName: t.name,
      tier: 'gold' as SponsorTier,
      amount: 25000, // Default to gold tier minimum
      status: 'available' as SponsorshipStatus,
      benefits: SPONSORSHIP_TIERS.gold.benefits,
      createdAt: new Date(),
    }));
  } catch (error) {
    console.error('[Sponsorship] Error fetching sponsorships:', error);
    return [];
  }
}

/**
 * Create sponsorship request
 */
export async function createSponsorshipRequest(data: {
  tournamentId: string;
  sponsorId: string;
  tier: SponsorTier;
  amount: number;
  customBenefits?: string[];
}): Promise<{ success: boolean; sponsorshipId?: string; error?: string }> {
  try {
    const tierConfig = SPONSORSHIP_TIERS[data.tier];
    
    if (data.amount < tierConfig.priceMin || data.amount > tierConfig.priceMax) {
      return {
        success: false,
        error: `Amount must be between ₹${tierConfig.priceMin.toLocaleString()} and ₹${tierConfig.priceMax.toLocaleString()} for ${tierConfig.name} tier.`,
      };
    }
    
    // Create sponsorship record
    const sponsorshipId = `sponsor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.$executeRaw`
      INSERT INTO TournamentSponsorship (
        id, tournamentId, sponsorId, tier, amount, status, benefits, createdAt
      ) VALUES (
        ${sponsorshipId},
        ${data.tournamentId},
        ${data.sponsorId},
        ${data.tier},
        ${data.amount},
        'pending',
        ${JSON.stringify([...tierConfig.benefits, ...(data.customBenefits || [])])},
        ${new Date()}
      )
    `;
    
    return { success: true, sponsorshipId };
  } catch (error) {
    console.error('[Sponsorship] Error creating request:', error);
    return { success: false, error: 'Failed to create sponsorship request' };
  }
}

/**
 * Get sponsor dashboard data
 */
export async function getSponsorDashboard(sponsorId: string): Promise<{
  activeSponsorships: TournamentSponsorship[];
  totalSpent: number;
  upcomingTournaments: TournamentSponsorship[];
}> {
  try {
    const sponsorships = await db.$queryRaw<Array<{
      id: string;
      tournamentId: string;
      tournamentName: string;
      tier: string;
      amount: number;
      status: string;
      benefits: string;
      createdAt: Date;
    }>>`
      SELECT 
        ts.id,
        ts.tournamentId,
        t.name as tournamentName,
        ts.tier,
        ts.amount,
        ts.status,
        ts.benefits,
        ts.createdAt
      FROM TournamentSponsorship ts
      JOIN Tournament t ON ts.tournamentId = t.id
      WHERE ts.sponsorId = ${sponsorId}
      ORDER BY ts.createdAt DESC
    `;
    
    const activeSponsorships = sponsorships
      .filter(s => s.status === 'confirmed')
      .map(s => ({
        id: s.id,
        tournamentId: s.tournamentId,
        tournamentName: s.tournamentName,
        tier: s.tier as SponsorTier,
        amount: s.amount,
        status: s.status as SponsorshipStatus,
        benefits: JSON.parse(s.benefits),
        createdAt: s.createdAt,
      }));
    
    const totalSpent = sponsorships
      .filter(s => s.status === 'confirmed' || s.status === 'completed')
      .reduce((sum, s) => sum + s.amount, 0);
    
    return {
      activeSponsorships,
      totalSpent,
      upcomingTournaments: activeSponsorships,
    };
  } catch (error) {
    console.error('[Sponsorship] Error fetching dashboard:', error);
    return {
      activeSponsorships: [],
      totalSpent: 0,
      upcomingTournaments: [],
    };
  }
}

/**
 * Calculate sponsor ROI metrics
 */
export function calculateSponsorROI(sponsorship: TournamentSponsorship, metrics: {
  tournamentParticipants: number;
  socialImpressions: number;
  certificateDownloads: number;
}): {
  costPerImpression: number;
  estimatedReach: number;
  visibilityScore: number;
} {
  const tier = SPONSORSHIP_TIERS[sponsorship.tier];
  const estimatedReach = metrics.tournamentParticipants + metrics.socialImpressions;
  const costPerImpression = estimatedReach > 0 ? sponsorship.amount / estimatedReach : 0;
  
  return {
    costPerImpression: Math.round(costPerImpression * 100) / 100,
    estimatedReach,
    visibilityScore: tier.visibilityScore,
  };
}

// ============================================
// Platform Commission
// ============================================

export const PLATFORM_COMMISSION_RATE = 0.15; // 15%

export function calculatePlatformCommission(sponsorshipAmount: number): {
  grossAmount: number;
  commission: number;
  netToTournament: number;
} {
  const commission = Math.round(sponsorshipAmount * PLATFORM_COMMISSION_RATE);
  return {
    grossAmount: sponsorshipAmount,
    commission,
    netToTournament: sponsorshipAmount - commission,
  };
}

export default {
  SPONSORSHIP_TIERS,
  SPONSOR_INDUSTRIES,
  getAvailableSponsorships,
  createSponsorshipRequest,
  getSponsorDashboard,
  calculateSponsorROI,
  calculatePlatformCommission,
  PLATFORM_COMMISSION_RATE,
};
