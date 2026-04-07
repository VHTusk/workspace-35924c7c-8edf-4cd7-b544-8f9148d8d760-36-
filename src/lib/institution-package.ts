/**
 * College/School Tournament Packages
 * 
 * Bulk registration and pricing for educational institutions
 * India market focused
 */

import { db } from '@/lib/db';
import { calculateBulkPrice, BULK_PRICING_TIERS } from '@/lib/pricing';

// ============================================
// Types
// ============================================

export type InstitutionType = 'school' | 'college' | 'university';
export type PackageStatus = 'draft' | 'pending_payment' | 'active' | 'completed' | 'expired';

export interface InstitutionPackage {
  id: string;
  institutionName: string;
  institutionType: InstitutionType;
  contactEmail: string;
  contactPhone: string;
  contactName: string;
  sport: string;
  participantCount: number;
  pricePerPlayer: number;
  totalPrice: number;
  discountPercent: number;
  status: PackageStatus;
  validFrom: Date;
  validUntil: Date;
  participants: InstitutionParticipant[];
  createdAt: Date;
}

export interface InstitutionParticipant {
  id: string;
  packageId: string;
  name: string;
  email: string;
  phone: string;
  studentId?: string;
  registered: boolean;
  registeredAt?: Date;
}

export interface InstitutionPackageRequest {
  institutionName: string;
  institutionType: InstitutionType;
  contactEmail: string;
  contactPhone: string;
  contactName: string;
  sport: string;
  participantCount: number;
  notes?: string;
}

// ============================================
// Package Benefits
// ============================================

export const INSTITUTION_PACKAGE_BENEFITS = [
  'Bulk discount on registration fees',
  'Dedicated coordinator dashboard',
  'Bulk player registration upload (CSV)',
  'Institution-specific tournament scheduling',
  'Participation certificates for all players',
  'Performance report at end of period',
  'Priority support via WhatsApp',
  'Annual sports day package discount',
];

// ============================================
// Minimum Participants
// ============================================

export const MINIMUM_PARTICIPANTS = 10;
export const MAXIMUM_PARTICIPANTS = 500;

// ============================================
// API Functions
// ============================================

/**
 * Create institution package request
 */
export async function createInstitutionPackage(
  data: InstitutionPackageRequest
): Promise<{ success: boolean; package?: InstitutionPackage; error?: string }> {
  // Validate participant count
  if (data.participantCount < MINIMUM_PARTICIPANTS) {
    return {
      success: false,
      error: `Minimum ${MINIMUM_PARTICIPANTS} participants required for institution packages.`,
    };
  }
  
  if (data.participantCount > MAXIMUM_PARTICIPANTS) {
    return {
      success: false,
      error: `Maximum ${MAXIMUM_PARTICIPANTS} participants per package. Contact support for larger groups.`,
    };
  }
  
  // Calculate pricing
  const pricing = calculateBulkPrice(data.participantCount);
  
  // Generate package
  const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const validFrom = new Date();
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 year validity
  
  const newPackage: InstitutionPackage = {
    id: packageId,
    institutionName: data.institutionName,
    institutionType: data.institutionType,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    contactName: data.contactName,
    sport: data.sport,
    participantCount: data.participantCount,
    pricePerPlayer: pricing.tier?.pricePerPlayer || 1500,
    totalPrice: pricing.discountedPrice,
    discountPercent: pricing.tier?.discountPercent || 0,
    status: 'draft',
    validFrom,
    validUntil,
    participants: [],
    createdAt: new Date(),
  };
  
  try {
    // Store in database
    await db.$executeRaw`
      INSERT INTO InstitutionPackage (
        id, institutionName, institutionType, contactEmail, contactPhone,
        contactName, sport, participantCount, pricePerPlayer, totalPrice,
        discountPercent, status, validFrom, validUntil, createdAt
      ) VALUES (
        ${newPackage.id},
        ${newPackage.institutionName},
        ${newPackage.institutionType},
        ${newPackage.contactEmail},
        ${newPackage.contactPhone},
        ${newPackage.contactName},
        ${newPackage.sport},
        ${newPackage.participantCount},
        ${newPackage.pricePerPlayer},
        ${newPackage.totalPrice},
        ${newPackage.discountPercent},
        ${newPackage.status},
        ${newPackage.validFrom},
        ${newPackage.validUntil},
        ${newPackage.createdAt}
      )
    `;
    
    return { success: true, package: newPackage };
  } catch (error) {
    console.error('[Institution Package] Error creating package:', error);
    return { success: false, error: 'Failed to create package. Please try again.' };
  }
}

/**
 * Add participants to package
 */
export async function addParticipantsToPackage(
  packageId: string,
  participants: Array<{
    name: string;
    email: string;
    phone: string;
    studentId?: string;
  }>
): Promise<{ success: boolean; added: number; error?: string }> {
  try {
    // Get package
    const packages = await db.$queryRaw<Array<{
      id: string;
      participantCount: number;
      status: string;
    }>>`
      SELECT id, participantCount, status
      FROM InstitutionPackage
      WHERE id = ${packageId}
    `;
    
    if (!packages || packages.length === 0) {
      return { success: false, added: 0, error: 'Package not found' };
    }
    
    const pkg = packages[0];
    
    if (pkg.status !== 'active') {
      return { success: false, added: 0, error: 'Package is not active' };
    }
    
    // Add participants
    let added = 0;
    for (const participant of participants) {
      try {
        const participantId = `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.$executeRaw`
          INSERT INTO InstitutionParticipant (
            id, packageId, name, email, phone, studentId, registered, createdAt
          ) VALUES (
            ${participantId},
            ${packageId},
            ${participant.name},
            ${participant.email},
            ${participant.phone},
            ${participant.studentId || null},
            false,
            ${new Date()}
          )
        `;
        added++;
      } catch {
        // Skip duplicates
      }
    }
    
    return { success: true, added };
  } catch (error) {
    console.error('[Institution Package] Error adding participants:', error);
    return { success: false, added: 0, error: 'Failed to add participants' };
  }
}

/**
 * Get package details
 */
export async function getInstitutionPackage(packageId: string): Promise<InstitutionPackage | null> {
  try {
    const packages = await db.$queryRaw<Array<{
      id: string;
      institutionName: string;
      institutionType: string;
      contactEmail: string;
      contactPhone: string;
      contactName: string;
      sport: string;
      participantCount: number;
      pricePerPlayer: number;
      totalPrice: number;
      discountPercent: number;
      status: string;
      validFrom: Date;
      validUntil: Date;
      createdAt: Date;
    }>>`
      SELECT * FROM InstitutionPackage WHERE id = ${packageId}
    `;
    
    if (!packages || packages.length === 0) {
      return null;
    }
    
    const p = packages[0];
    
    // Get participants
    const participants = await db.$queryRaw<Array<{
      id: string;
      packageId: string;
      name: string;
      email: string;
      phone: string;
      studentId: string | null;
      registered: number;
      registeredAt: Date | null;
    }>>`
      SELECT id, packageId, name, email, phone, studentId, registered, registeredAt
      FROM InstitutionParticipant
      WHERE packageId = ${packageId}
    `;
    
    return {
      ...p,
      institutionType: p.institutionType as InstitutionType,
      status: p.status as PackageStatus,
      participants: participants.map(part => ({
        id: part.id,
        packageId: part.packageId,
        name: part.name,
        email: part.email,
        phone: part.phone,
        studentId: part.studentId || undefined,
        registered: part.registered === 1,
        registeredAt: part.registeredAt || undefined,
      })),
    };
  } catch (error) {
    console.error('[Institution Package] Error fetching package:', error);
    return null;
  }
}

/**
 * Generate CSV template for participant upload
 */
export function generateParticipantCSVTemplate(): string {
  return `Name,Email,Phone,Student ID
John Doe,john@school.edu,9876543210,STU001
Jane Smith,jane@school.edu,9876543211,STU002
...`;
}

/**
 * Parse CSV upload for participants
 */
export function parseParticipantCSV(csvContent: string): Array<{
  name: string;
  email: string;
  phone: string;
  studentId?: string;
}> {
  const lines = csvContent.trim().split('\n');
  const participants: Array<{ name: string; email: string; phone: string; studentId?: string }> = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]?.split(',').map(p => p.trim());
    if (parts && parts.length >= 3) {
      participants.push({
        name: parts[0] || '',
        email: parts[1] || '',
        phone: parts[2] || '',
        studentId: parts[3] || undefined,
      });
    }
  }
  
  return participants;
}

/**
 * Get pricing quote for institution
 */
export function getInstitutionPricingQuote(participantCount: number): {
  tier: string;
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  savingsPercent: number;
  benefits: string[];
} {
  const pricing = calculateBulkPrice(participantCount);
  const tier = pricing.tier;
  
  let tierName = 'Standard';
  if (participantCount >= 200) tierName = 'Platinum';
  else if (participantCount >= 100) tierName = 'Gold';
  else if (participantCount >= 50) tierName = 'Silver';
  else if (participantCount >= 25) tierName = 'Bronze';
  
  return {
    tier: tierName,
    originalPrice: pricing.originalPrice,
    discountedPrice: pricing.discountedPrice,
    savings: pricing.savings,
    savingsPercent: tier?.discountPercent || 0,
    benefits: INSTITUTION_PACKAGE_BENEFITS,
  };
}

export default {
  createInstitutionPackage,
  addParticipantsToPackage,
  getInstitutionPackage,
  generateParticipantCSVTemplate,
  parseParticipantCSV,
  getInstitutionPricingQuote,
  INSTITUTION_PACKAGE_BENEFITS,
  MINIMUM_PARTICIPANTS,
  MAXIMUM_PARTICIPANTS,
  BULK_PRICING_TIERS,
};
