/**
 * Profession Manager (v3.53.0)
 * 
 * Handles user profession declaration, verification, and management.
 * Phase 1 MVP: Self-declaration with optional verification for rewards.
 * 
 * All professions have formal associations / councils / statutory bodies
 * that can verify membership numbers and issue ID cards.
 */

import { db } from '@/lib/db';
import { Profession, ProfessionVerificationStatus } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface SetProfessionParams {
  userId: string;
  profession: Profession;
  membershipNumber?: string;
  showPublicly?: boolean;
}

export interface SetProfessionResult {
  success: boolean;
  user?: {
    id: string;
    profession: Profession | null;
    professionMembershipNumber: string | null;
    professionGoverningBody: string | null;
    professionVerified: ProfessionVerificationStatus;
    showProfessionPublicly: boolean;
  };
  error?: string;
}

export interface ProfessionInfo {
  profession: Profession | null;
  membershipNumber: string | null;
  governingBody: string | null;
  verificationStatus: ProfessionVerificationStatus;
  verifiedAt: Date | null;
  showPublicly: boolean;
  canClaimRewards: boolean;
  documentUrl: string | null;
}

// ============================================
// PROFESSION LABELS & GOVERNING BODIES
// ============================================

export const PROFESSION_LABELS: Record<Profession, string> = {
  DOCTOR: 'Doctor (MBBS/MD)',
  DENTIST: 'Dentist (BDS/MDS)',
  NURSE: 'Nurse',
  PHARMACIST: 'Pharmacist',
  PHYSIOTHERAPIST: 'Physiotherapist',
  RADIOLOGIST: 'Radiologist',
  AYURVEDIC_DOCTOR: 'Ayurvedic Doctor (BAMS)',
  HOMEOPATHIC_DOCTOR: 'Homeopathic Doctor (BHMS)',
  LAWYER: 'Lawyer (Advocate)',
  COMPANY_SECRETARY: 'Company Secretary',
  NOTARY: 'Notary',
  CHARTERED_ACCOUNTANT: 'Chartered Accountant',
  COST_ACCOUNTANT: 'Cost Accountant (CMA)',
  ACTUARY: 'Actuary',
  ARCHITECT: 'Architect',
  ENGINEER: 'Engineer',
  TOWN_PLANNER: 'Town Planner',
  TEACHER: 'Teacher',
  PROFESSOR: 'Professor',
  JOURNALIST: 'Journalist',
  REAL_ESTATE_AGENT: 'Real Estate Agent',
  INSURANCE_AGENT: 'Insurance Agent',
  STOCK_BROKER: 'Stock Broker',
  MUTUAL_FUND_DISTRIBUTOR: 'Mutual Fund Distributor',
  PILOT: 'Pilot',
  AIRCRAFT_ENGINEER: 'Aircraft Engineer',
  AIR_TRAFFIC_CONTROLLER: 'Air Traffic Controller',
  STRUCTURAL_ENGINEER: 'Structural Engineer',
  CONTRACTOR: 'Contractor',
  AGRICULTURAL_SCIENTIST: 'Agricultural Scientist',
  VETERINARIAN: 'Veterinarian',
  COACH: 'Sports Coach',
  REFEREE: 'Referee/Umpire',
  OTHER: 'Other',
};

export const PROFESSION_GOVERNING_BODIES: Record<Profession, string> = {
  DOCTOR: 'National Medical Commission (NMC)',
  DENTIST: 'Dental Council of India (DCI)',
  NURSE: 'Indian Nursing Council (INC)',
  PHARMACIST: 'Pharmacy Council of India (PCI)',
  PHYSIOTHERAPIST: 'Indian Association of Physiotherapists',
  RADIOLOGIST: 'Indian Radiological & Imaging Association',
  AYURVEDIC_DOCTOR: 'Central Council of Indian Medicine',
  HOMEOPATHIC_DOCTOR: 'National Commission for Homoeopathy',
  LAWYER: 'Bar Council of India',
  COMPANY_SECRETARY: 'Institute of Company Secretaries of India (ICSI)',
  NOTARY: 'Ministry of Law & Justice',
  CHARTERED_ACCOUNTANT: 'ICAI',
  COST_ACCOUNTANT: 'ICMAI',
  ACTUARY: 'Institute of Actuaries of India',
  ARCHITECT: 'Council of Architecture (COA)',
  ENGINEER: 'Institution of Engineers (India)',
  TOWN_PLANNER: 'Institute of Town Planners India',
  TEACHER: 'CBSE / State Education Boards / UGC',
  PROFESSOR: 'UGC',
  JOURNALIST: 'Press Council of India',
  REAL_ESTATE_AGENT: 'RERA (State-wise)',
  INSURANCE_AGENT: 'IRDAI',
  STOCK_BROKER: 'SEBI',
  MUTUAL_FUND_DISTRIBUTOR: 'AMFI',
  PILOT: 'DGCA',
  AIRCRAFT_ENGINEER: 'DGCA',
  AIR_TRAFFIC_CONTROLLER: 'AAI',
  STRUCTURAL_ENGINEER: 'IEI / Professional Bodies',
  CONTRACTOR: 'Builders Associations',
  AGRICULTURAL_SCIENTIST: 'ICAR',
  VETERINARIAN: 'Veterinary Council of India',
  COACH: 'National Sports Federations',
  REFEREE: 'Federation-Specific',
  OTHER: 'Not Applicable',
};

export const PROFESSION_ICONS: Record<Profession, string> = {
  DOCTOR: '🏥',
  DENTIST: '🦷',
  NURSE: '👩‍⚕️',
  PHARMACIST: '💊',
  PHYSIOTHERAPIST: '🏃',
  RADIOLOGIST: '🔬',
  AYURVEDIC_DOCTOR: '🌿',
  HOMEOPATHIC_DOCTOR: '🍃',
  LAWYER: '⚖️',
  COMPANY_SECRETARY: '📋',
  NOTARY: '📜',
  CHARTERED_ACCOUNTANT: '📊',
  COST_ACCOUNTANT: '📈',
  ACTUARY: '🧮',
  ARCHITECT: '🏗️',
  ENGINEER: '🔧',
  TOWN_PLANNER: '🏘️',
  TEACHER: '📚',
  PROFESSOR: '🎓',
  JOURNALIST: '📰',
  REAL_ESTATE_AGENT: '🏠',
  INSURANCE_AGENT: '🛡️',
  STOCK_BROKER: '📈',
  MUTUAL_FUND_DISTRIBUTOR: '💹',
  PILOT: '✈️',
  AIRCRAFT_ENGINEER: '🔩',
  AIR_TRAFFIC_CONTROLLER: '🗼',
  STRUCTURAL_ENGINEER: '🏗️',
  CONTRACTOR: '🔨',
  AGRICULTURAL_SCIENTIST: '🌾',
  VETERINARIAN: '🐾',
  COACH: '🏅',
  REFEREE: '哨',
  OTHER: '📋',
};

// Profession categories for UI grouping
export const PROFESSION_CATEGORIES = {
  'Medical & Allied': [
    'DOCTOR', 'DENTIST', 'NURSE', 'PHARMACIST', 'PHYSIOTHERAPIST',
    'RADIOLOGIST', 'AYURVEDIC_DOCTOR', 'HOMEOPATHIC_DOCTOR'
  ] as Profession[],
  'Legal': [
    'LAWYER', 'COMPANY_SECRETARY', 'NOTARY'
  ] as Profession[],
  'Finance & Audit': [
    'CHARTERED_ACCOUNTANT', 'COST_ACCOUNTANT', 'ACTUARY'
  ] as Profession[],
  'Engineering & Architecture': [
    'ARCHITECT', 'ENGINEER', 'TOWN_PLANNER', 'STRUCTURAL_ENGINEER'
  ] as Profession[],
  'Education': [
    'TEACHER', 'PROFESSOR'
  ] as Profession[],
  'Media': [
    'JOURNALIST'
  ] as Profession[],
  'Real Estate': [
    'REAL_ESTATE_AGENT'
  ] as Profession[],
  'Technical & Finance': [
    'INSURANCE_AGENT', 'STOCK_BROKER', 'MUTUAL_FUND_DISTRIBUTOR'
  ] as Profession[],
  'Aviation': [
    'PILOT', 'AIRCRAFT_ENGINEER', 'AIR_TRAFFIC_CONTROLLER'
  ] as Profession[],
  'Construction': [
    'CONTRACTOR'
  ] as Profession[],
  'Agriculture': [
    'AGRICULTURAL_SCIENTIST', 'VETERINARIAN'
  ] as Profession[],
  'Sports': [
    'COACH', 'REFEREE'
  ] as Profession[],
  'Other': [
    'OTHER'
  ] as Profession[],
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Set or update a user's profession with membership number
 * MVP: Self-declaration, no verification required initially
 */
export async function setUserProfession(
  params: SetProfessionParams
): Promise<SetProfessionResult> {
  try {
    const { userId, profession, membershipNumber, showPublicly = false } = params;

    // Get current user state
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profession: true,
        professionVerified: true,
        showProfessionPublicly: true,
      },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Determine verification status
    // If profession is changing, reset verification
    let verificationStatus: ProfessionVerificationStatus = ProfessionVerificationStatus.SELF_DECLARED;
    
    if (user.profession === profession && user.professionVerified !== ProfessionVerificationStatus.NONE) {
      // Same profession, keep existing verification status
      verificationStatus = user.professionVerified;
    }

    // Get governing body for this profession
    const governingBody = PROFESSION_GOVERNING_BODIES[profession];

    // Update user
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        profession,
        professionMembershipNumber: membershipNumber || null,
        professionGoverningBody: governingBody,
        professionVerified: verificationStatus,
        showProfessionPublicly: showPublicly,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        profession: true,
        professionMembershipNumber: true,
        professionGoverningBody: true,
        professionVerified: true,
        showProfessionPublicly: true,
      },
    });

    return {
      success: true,
      user: updated,
    };
  } catch (error) {
    console.error('Error setting profession:', error);
    return { success: false, error: 'Failed to set profession' };
  }
}

/**
 * Get a user's profession information
 */
export async function getUserProfession(userId: string): Promise<ProfessionInfo | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        profession: true,
        professionMembershipNumber: true,
        professionGoverningBody: true,
        professionVerified: true,
        professionVerifiedAt: true,
        showProfessionPublicly: true,
        professionDocumentUrl: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      profession: user.profession,
      membershipNumber: user.professionMembershipNumber,
      governingBody: user.professionGoverningBody,
      verificationStatus: user.professionVerified,
      verifiedAt: user.professionVerifiedAt,
      showPublicly: user.showProfessionPublicly,
      canClaimRewards: user.professionVerified === ProfessionVerificationStatus.VERIFIED,
      documentUrl: user.professionDocumentUrl,
    };
  } catch (error) {
    console.error('Error getting profession:', error);
    return null;
  }
}

/**
 * Clear a user's profession
 */
export async function clearUserProfession(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        profession: null,
        professionMembershipNumber: null,
        professionGoverningBody: null,
        professionVerified: ProfessionVerificationStatus.NONE,
        professionDocumentUrl: null,
        professionVerifiedAt: null,
        professionVerifiedBy: null,
        showProfessionPublicly: false,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error clearing profession:', error);
    return { success: false, error: 'Failed to clear profession' };
  }
}

/**
 * Update profession visibility
 */
export async function setProfessionVisibility(
  userId: string,
  showPublicly: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        showProfessionPublicly: showPublicly,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating visibility:', error);
    return { success: false, error: 'Failed to update visibility' };
  }
}

/**
 * Update membership number
 */
export async function setMembershipNumber(
  userId: string,
  membershipNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        professionMembershipNumber: membershipNumber,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating membership number:', error);
    return { success: false, error: 'Failed to update membership number' };
  }
}

/**
 * Check if a user can claim rewards for profession-exclusive tournaments
 */
export function canClaimProfessionRewards(
  verificationStatus: ProfessionVerificationStatus
): boolean {
  return verificationStatus === ProfessionVerificationStatus.VERIFIED;
}

/**
 * Check if profession needs verification
 */
export function needsProfessionVerification(
  verificationStatus: ProfessionVerificationStatus
): boolean {
  return verificationStatus === ProfessionVerificationStatus.SELF_DECLARED ||
         verificationStatus === ProfessionVerificationStatus.PENDING;
}

/**
 * Get all available professions
 */
export function getAllProfessions(): Profession[] {
  return Object.keys(PROFESSION_LABELS) as Profession[];
}

/**
 * Get profession display info
 */
export function getProfessionDisplay(profession: Profession): {
  label: string;
  icon: string;
  governingBody: string;
} {
  return {
    label: PROFESSION_LABELS[profession],
    icon: PROFESSION_ICONS[profession],
    governingBody: PROFESSION_GOVERNING_BODIES[profession],
  };
}

/**
 * Get professions by category
 */
export function getProfessionsByCategory(): Record<string, { profession: Profession; label: string; governingBody: string }[]> {
  const result: Record<string, { profession: Profession; label: string; governingBody: string }[]> = {};
  
  for (const [category, professions] of Object.entries(PROFESSION_CATEGORIES)) {
    result[category] = professions.map(p => ({
      profession: p,
      label: PROFESSION_LABELS[p],
      governingBody: PROFESSION_GOVERNING_BODIES[p],
    }));
  }
  
  return result;
}

// ============================================
// DOCUMENT UPLOAD FUNCTIONS
// ============================================

/**
 * Upload profession verification document
 */
export async function uploadProfessionDocument(
  userId: string,
  documentUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { profession: true },
    });

    if (!user || !user.profession) {
      return { success: false, error: 'No profession declared' };
    }

    await db.user.update({
      where: { id: userId },
      data: {
        professionDocumentUrl: documentUrl,
        professionVerified: ProfessionVerificationStatus.PENDING,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error uploading document:', error);
    return { success: false, error: 'Failed to upload document' };
  }
}

/**
 * Verify a user's profession (Admin only)
 */
export async function verifyUserProfession(
  userId: string,
  adminId: string,
  approved: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        professionVerified: approved 
          ? ProfessionVerificationStatus.VERIFIED 
          : ProfessionVerificationStatus.REJECTED,
        professionVerifiedAt: new Date(),
        professionVerifiedBy: adminId,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error verifying profession:', error);
    return { success: false, error: 'Failed to verify profession' };
  }
}

/**
 * Get users pending profession verification (Admin only)
 */
export async function getPendingProfessionVerifications(limit: number = 50) {
  try {
    return await db.user.findMany({
      where: {
        professionVerified: ProfessionVerificationStatus.PENDING,
        profession: { not: null },
        professionDocumentUrl: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profession: true,
        professionMembershipNumber: true,
        professionGoverningBody: true,
        professionDocumentUrl: true,
        createdAt: true,
      },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });
  } catch (error) {
    console.error('Error getting pending verifications:', error);
    return [];
  }
}

// ============================================
// PROFESSION TITLES FOR RECOGNITION
// ============================================

/**
 * Generate profession-specific title
 */
export function generateProfessionTitle(
  profession: Profession,
  scope: 'CITY' | 'DISTRICT' | 'STATE' | 'NATIONAL',
  locationName: string
): string {
  const professionName = PROFESSION_LABELS[profession];
  
  switch (scope) {
    case 'CITY':
      return `${locationName} ${professionName} Champion`;
    case 'DISTRICT':
      return `${locationName} District ${professionName} Champion`;
    case 'STATE':
      return `${locationName} State ${professionName} Champion`;
    case 'NATIONAL':
      return `National ${professionName} Champion`;
    default:
      return `${professionName} Champion`;
  }
}

/**
 * Get profession titles won by a user
 */
export async function getUserProfessionTitles(userId: string) {
  // This will be integrated with the recognition system
  // For now, return empty array
  return [];
}
