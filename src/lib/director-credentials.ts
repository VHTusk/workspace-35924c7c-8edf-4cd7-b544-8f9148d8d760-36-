/**
 * Tournament Director Credential Management (v3.52.0)
 * 
 * Handles generation, sharing, and management of director login credentials.
 * Directors don't need profiles - they just need login access to manage their tournaments.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { buildAppUrl } from '@/lib/app-url';

// Credential configuration
const USERNAME_PREFIX = 'td_'; // Tournament Director prefix
const PASSWORD_LENGTH = 10;
const USERNAME_RANDOM_LENGTH = 6;

/**
 * Generate a random alphanumeric string
 */
function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a secure random password
 */
function generatePassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%';
  
  let password = '';
  
  // Ensure at least one of each type
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  // Fill the rest with random chars
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = password.length; i < PASSWORD_LENGTH; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generate a unique username for tournament director
 */
async function generateUniqueUsername(tournamentId: string): Promise<string> {
  // Try with tournament ID suffix first (shortened)
  const shortId = tournamentId.slice(-4).toLowerCase();
  let username = `${USERNAME_PREFIX}${shortId}`;
  
  // Check if exists
  const existing = await db.tournament.findFirst({
    where: { directorUsername: username },
  });
  
  if (!existing) {
    return username;
  }
  
  // Generate with random suffix
  for (let i = 0; i < 10; i++) {
    const randomSuffix = generateRandomString(USERNAME_RANDOM_LENGTH);
    username = `${USERNAME_PREFIX}${randomSuffix}`;
    
    const exists = await db.tournament.findFirst({
      where: { directorUsername: username },
    });
    
    if (!exists) {
      return username;
    }
  }
  
  // Fallback to timestamp-based
  return `${USERNAME_PREFIX}${Date.now().toString(36)}`;
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyDirectorPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate credentials for a tournament director
 */
export interface GeneratedCredentials {
  username: string;
  password: string; // Plain text for sharing
  passwordHash: string;
}

export async function generateDirectorCredentials(
  tournamentId: string
): Promise<GeneratedCredentials> {
  const username = await generateUniqueUsername(tournamentId);
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  
  return {
    username,
    password,
    passwordHash,
  };
}

/**
 * Assign director to tournament with auto-generated credentials
 */
export interface AssignDirectorParams {
  tournamentId: string;
  name: string;
  phone: string;
  email?: string;
  assignedById: string;
}

export interface AssignDirectorResult {
  success: boolean;
  tournament?: {
    id: string;
    name: string;
    directorName: string;
    directorPhone: string;
    directorEmail?: string | null;
    directorUsername: string;
  };
  credentials?: {
    username: string;
    password: string;
  };
  error?: string;
}

export async function assignDirectorToTournament(
  params: AssignDirectorParams
): Promise<AssignDirectorResult> {
  try {
    const { tournamentId, name, phone, email, assignedById } = params;
    
    // Check tournament exists
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true },
    });
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    // Generate credentials
    const credentials = await generateDirectorCredentials(tournamentId);
    
    // Update tournament with director info
    const updated = await db.tournament.update({
      where: { id: tournamentId },
      data: {
        directorName: name,
        directorPhone: phone,
        directorEmail: email || null,
        directorUsername: credentials.username,
        directorPasswordHash: credentials.passwordHash,
        directorCredentialsSent: false,
        directorAssignedById: assignedById,
        directorAssignedAt: new Date(),
      },
    });
    
    return {
      success: true,
      tournament: {
        id: updated.id,
        name: updated.name,
        directorName: updated.directorName!,
        directorPhone: updated.directorPhone!,
        directorEmail: updated.directorEmail,
        directorUsername: updated.directorUsername!,
      },
      credentials: {
        username: credentials.username,
        password: credentials.password,
      },
    };
  } catch (error) {
    console.error('Error assigning director:', error);
    return { success: false, error: 'Failed to assign director' };
  }
}

/**
 * Update director information (keeps existing credentials)
 */
export interface UpdateDirectorParams {
  tournamentId: string;
  name?: string;
  phone?: string;
  email?: string;
  regenerateCredentials?: boolean;
}

export async function updateDirector(
  params: UpdateDirectorParams
): Promise<AssignDirectorResult> {
  try {
    const { tournamentId, name, phone, email, regenerateCredentials } = params;
    
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
    });
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    const updateData: Record<string, unknown> = {};
    
    if (name) updateData.directorName = name;
    if (phone) updateData.directorPhone = phone;
    if (email !== undefined) updateData.directorEmail = email || null;
    
    let credentials: { username: string; password: string } | undefined;
    
    if (regenerateCredentials || !tournament.directorUsername) {
      const newCreds = await generateDirectorCredentials(tournamentId);
      updateData.directorUsername = newCreds.username;
      updateData.directorPasswordHash = newCreds.passwordHash;
      updateData.directorCredentialsSent = false;
      credentials = {
        username: newCreds.username,
        password: newCreds.password,
      };
    }
    
    const updated = await db.tournament.update({
      where: { id: tournamentId },
      data: updateData,
    });
    
    return {
      success: true,
      tournament: {
        id: updated.id,
        name: updated.name,
        directorName: updated.directorName!,
        directorPhone: updated.directorPhone!,
        directorEmail: updated.directorEmail,
        directorUsername: updated.directorUsername!,
      },
      credentials,
    };
  } catch (error) {
    console.error('Error updating director:', error);
    return { success: false, error: 'Failed to update director' };
  }
}

/**
 * Remove director from tournament
 */
export async function removeDirectorFromTournament(
  tournamentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.tournament.update({
      where: { id: tournamentId },
      data: {
        directorName: null,
        directorPhone: null,
        directorEmail: null,
        directorUsername: null,
        directorPasswordHash: null,
        directorCredentialsSent: false,
        directorAssignedById: null,
        directorAssignedAt: null,
      },
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error removing director:', error);
    return { success: false, error: 'Failed to remove director' };
  }
}

/**
 * Mark credentials as sent
 */
export async function markCredentialsSent(
  tournamentId: string
): Promise<void> {
  await db.tournament.update({
    where: { id: tournamentId },
    data: { directorCredentialsSent: true },
  });
}

/**
 * Format credentials message for sharing
 */
export function formatCredentialsMessage(
  tournamentName: string,
  username: string,
  password: string
): string {
  return `🎯 VALORHIVE Tournament Director Access

You have been assigned as the Tournament Director for:
📋 ${tournamentName}

Your login credentials:
👤 Username: ${username}
🔑 Password: ${password}

Login at: ${buildAppUrl('/director/login')}

Please keep these credentials secure.
You can manage your tournament after logging in.

For any issues, contact support.`;
}

/**
 * Format credentials for SMS (shorter version)
 */
export function formatCredentialsSMS(
  tournamentName: string,
  username: string,
  password: string
): string {
  return `VALORHIVE: You're assigned as Director for "${tournamentName}". Login: ${username} | Pass: ${password}. Login at ${buildAppUrl('/director/login')}`;
}

// ============================================
// MAGIC LINK AUTHENTICATION (v3.52.0)
// ============================================

const MAGIC_LINK_EXPIRY_HOURS = 1; // Magic links expire in 1 hour
const MAGIC_LINK_TOKEN_LENGTH = 32;

/**
 * Generate a secure magic link token
 */
function generateMagicLinkToken(): string {
  return crypto.randomBytes(MAGIC_LINK_TOKEN_LENGTH).toString('base64url');
}

/**
 * Create a magic link for director login
 */
export interface CreateMagicLinkParams {
  tournamentId: string;
  phone: string;
  email?: string;
}

export interface CreateMagicLinkResult {
  success: boolean;
  magicLink?: string;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export async function createDirectorMagicLink(
  params: CreateMagicLinkParams
): Promise<CreateMagicLinkResult> {
  try {
    const { tournamentId, phone, email } = params;
    
    // Verify tournament has this director assigned
    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        id: true, 
        name: true,
        directorPhone: true,
        directorEmail: true,
      },
    });
    
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }
    
    // Verify phone matches
    if (tournament.directorPhone !== phone) {
      return { success: false, error: 'Phone number does not match assigned director' };
    }
    
    // Generate token
    const token = generateMagicLinkToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Delete any existing magic links for this tournament
    await db.directorMagicLink.deleteMany({
      where: { tournamentId },
    });
    
    // Create new magic link
    await db.directorMagicLink.create({
      data: {
        tournamentId,
        token,
        phone,
        email: email || null,
        expiresAt,
      },
    });
    
    // Generate the full magic link URL
    const magicLink = buildAppUrl(`/director/magic-login?token=${token}`);
    
    return {
      success: true,
      magicLink,
      token,
      expiresAt,
    };
  } catch (error) {
    console.error('Error creating magic link:', error);
    return { success: false, error: 'Failed to create magic link' };
  }
}

/**
 * Validate a magic link token
 */
export interface ValidateMagicLinkResult {
  valid: boolean;
  tournamentId?: string;
  tournamentName?: string;
  error?: string;
}

export async function validateDirectorMagicLink(
  token: string
): Promise<ValidateMagicLinkResult> {
  try {
    const magicLink = await db.directorMagicLink.findUnique({
      where: { token },
      include: {
        tournament: {
          select: { id: true, name: true, directorPhone: true },
        },
      },
    });
    
    if (!magicLink) {
      return { valid: false, error: 'Invalid magic link' };
    }
    
    if (magicLink.usedAt) {
      return { valid: false, error: 'Magic link already used' };
    }
    
    if (magicLink.expiresAt < new Date()) {
      return { valid: false, error: 'Magic link expired' };
    }
    
    return {
      valid: true,
      tournamentId: magicLink.tournamentId,
      tournamentName: magicLink.tournament.name,
    };
  } catch (error) {
    console.error('Error validating magic link:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

/**
 * Use a magic link (consume it and create session)
 */
export interface UseMagicLinkResult {
  success: boolean;
  sessionToken?: string;
  tournament?: {
    id: string;
    name: string;
    status: string;
    directorName: string;
  };
  error?: string;
}

export async function useDirectorMagicLink(
  token: string
): Promise<UseMagicLinkResult> {
  try {
    const validation = await validateDirectorMagicLink(token);
    
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Mark magic link as used
    await db.directorMagicLink.update({
      where: { token },
      data: { usedAt: new Date() },
    });
    
    // Create director session
    const sessionToken = `ds_${Date.now()}_${crypto.randomBytes(16).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await db.directorSession.create({
      data: {
        tournamentId: validation.tournamentId!,
        token: sessionToken,
        expiresAt,
      },
    });
    
    // Get tournament details
    const tournament = await db.tournament.findUnique({
      where: { id: validation.tournamentId },
      select: { id: true, name: true, status: true, directorName: true },
    });
    
    return {
      success: true,
      sessionToken,
      tournament: tournament ? {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        directorName: tournament.directorName || 'Director',
      } : undefined,
    };
  } catch (error) {
    console.error('Error using magic link:', error);
    return { success: false, error: 'Failed to use magic link' };
  }
}

/**
 * Create a director session (for password login)
 */
export async function createDirectorSession(
  tournamentId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = `ds_${Date.now()}_${crypto.randomBytes(16).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await db.directorSession.create({
    data: {
      tournamentId,
      token,
      expiresAt,
    },
  });
  
  return { token, expiresAt };
}

/**
 * Validate a director session
 */
export async function validateDirectorSession(
  token: string
): Promise<{ valid: boolean; tournamentId?: string; tournament?: { id: string; name: string; status: string } }> {
  const session = await db.directorSession.findUnique({
    where: { token },
    include: {
      tournament: {
        select: { id: true, name: true, status: true },
      },
    },
  });
  
  if (!session) {
    return { valid: false };
  }
  
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await db.directorSession.delete({ where: { token } });
    return { valid: false };
  }
  
  // Update last activity only if more than 5 minutes have passed
  // This reduces database writes from potentially every request to at most once per 5 minutes
  const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
  if (!session.lastActivityAt || session.lastActivityAt < FIVE_MINUTES_AGO) {
    db.directorSession.update({
      where: { token },
      data: { lastActivityAt: new Date() },
    }).catch(() => {});
  }
  
  return {
    valid: true,
    tournamentId: session.tournamentId,
    tournament: session.tournament,
  };
}

/**
 * Format magic link message for SMS
 */
export function formatMagicLinkSMS(
  tournamentName: string,
  magicLink: string
): string {
  return `VALORHIVE: Click to login as Director for "${tournamentName}": ${magicLink}. Link expires in 1 hour.`;
}

/**
 * Format magic link message for email
 */
export function formatMagicLinkEmail(
  tournamentName: string,
  magicLink: string
): string {
  return `🎯 VALORHIVE Tournament Director Access

You have been assigned as the Tournament Director for:
📋 ${tournamentName}

Click the link below to login instantly:
🔗 ${magicLink}

This link expires in 1 hour and can only be used once.

For any issues, contact support.`;
}

// ============================================
// PRIVACY SETTINGS (v3.52.0)
// ============================================

/**
 * Update director contact visibility
 */
export async function setDirectorContactVisibility(
  tournamentId: string,
  showContact: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.tournament.update({
      where: { id: tournamentId },
      data: { showDirectorContact: showContact },
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating director visibility:', error);
    return { success: false, error: 'Failed to update visibility' };
  }
}

/**
 * Check if director contact should be shown to a specific user
 */
export async function shouldShowDirectorContact(
  tournamentId: string,
  userRole: 'PUBLIC' | 'PLAYER' | 'DIRECTOR' | 'ADMIN'
): Promise<boolean> {
  // Admins always see
  if (userRole === 'ADMIN') return true;
  
  // Directors see their own info
  if (userRole === 'DIRECTOR') return true;
  
  // Public never sees
  if (userRole === 'PUBLIC') return false;
  
  // Players see based on toggle
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { showDirectorContact: true },
  });
  
  return tournament?.showDirectorContact ?? false;
}
