/**
 * Social Sharing Integration for VALORHIVE
 * 
 * Features:
 * - Share link generation for tournaments, players, organizations
 * - Platform-specific share URLs (WhatsApp, Twitter, Facebook, LinkedIn)
 * - Share tracking for analytics
 * - Open Graph image URL generation
 */

import { db } from '@/lib/db'

// ============================================
// Types and Interfaces
// ============================================

export type ShareType = 'tournament' | 'player' | 'organization' | 'match' | 'leaderboard'

export type SocialPlatform = 'whatsapp' | 'twitter' | 'facebook' | 'linkedin' | 'telegram' | 'email' | 'copy'

export interface ShareData {
  url: string
  title: string
  description: string
  image?: string
  hashtags?: string[]
}

export interface ShareLink {
  id: string
  shortCode: string
  type: ShareType
  entityId: string
  url: string
  createdAt: Date
  expiresAt?: Date | null
}

export interface ShareAnalytics {
  totalShares: number
  sharesByPlatform: Record<SocialPlatform, number>
  sharesOverTime: { date: string; count: number }[]
}

export interface ShareEvent {
  id: string
  shareLinkId: string
  platform: SocialPlatform
  ip?: string
  userAgent?: string
  referrer?: string
  createdAt: Date
}

// ============================================
// Constants
// ============================================

const HASHTAGS = {
  CORNHOLE: ['Cornhole', 'CornholeTournament', 'CornholeLife', 'ACLPro'],
  DARTS: ['Darts', 'DartsTournament', 'DartsLife', 'PDC'],
  GENERAL: ['VALORHIVE', 'TournamentGaming', 'CompetitiveSports'],
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://valorhive.com'

// Short code character set (alphanumeric, no ambiguous chars)
const SHORT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHORT_CODE_LENGTH = 8

// ============================================
// Share Link Generation
// ============================================

/**
 * Generate a random short code for share links
 */
function generateShortCode(): string {
  let code = ''
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += SHORT_CODE_CHARS.charAt(Math.floor(Math.random() * SHORT_CODE_CHARS.length))
  }
  return code
}

/**
 * Generate a shareable URL for a resource
 */
export function generateShareUrl(type: ShareType, id: string, sport?: string): string {
  const baseUrls: Record<ShareType, string> = {
    tournament: `${BASE_URL}/tournaments/${id}`,
    player: `${BASE_URL}/players/${id}`,
    organization: `${BASE_URL}/organizations/${id}`,
    match: `${BASE_URL}/matches/${id}`,
    leaderboard: sport ? `${BASE_URL}/${sport.toLowerCase()}/leaderboard` : `${BASE_URL}/leaderboard`,
  }
  
  return baseUrls[type]
}

/**
 * Generate a short share link and store in database
 */
export async function createShareLink(
  type: ShareType,
  entityId: string,
  expiresInDays?: number
): Promise<ShareLink> {
  const shortCode = generateShortCode()
  const url = generateShareUrl(type, entityId)
  
  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null
  
  // Store in database using raw query for ShareLink table
  const result = await db.$executeRaw`
    INSERT INTO ShareLink (id, shortCode, type, entityId, url, createdAt, expiresAt)
    VALUES (${generateCuid()}, ${shortCode}, ${type}, ${entityId}, ${url}, ${new Date()}, ${expiresAt})
  `
  
  return {
    id: shortCode,
    shortCode,
    type,
    entityId,
    url,
    createdAt: new Date(),
    expiresAt,
  }
}

/**
 * Generate a CUID-like ID
 */
function generateCuid(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `c${timestamp}${random}`
}

/**
 * Get share link by short code
 */
export async function getShareLinkByShortCode(shortCode: string): Promise<ShareLink | null> {
  try {
    const results = await db.$queryRaw<Array<{
      id: string
      shortCode: string
      type: string
      entityId: string
      url: string
      createdAt: Date
      expiresAt: Date | null
    }>>`
      SELECT id, shortCode, type, entityId, url, createdAt, expiresAt
      FROM ShareLink
      WHERE shortCode = ${shortCode}
    `
    
    if (!results || results.length === 0) {
      return null
    }
    
    const row = results[0]
    
    // Check if expired
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      return null
    }
    
    return {
      ...row,
      type: row.type as ShareType,
    }
  } catch {
    // Table might not exist yet
    return null
  }
}

/**
 * Get short URL for a resource
 */
export function getShortUrl(shortCode: string): string {
  return `${BASE_URL}/s/${shortCode}`
}

// ============================================
// Open Graph Image Generation
// ============================================

/**
 * Generate Open Graph image URL for a resource
 */
export function generateShareImage(type: ShareType, id: string): string {
  return `${BASE_URL}/api/og/${type}/${id}`
}

/**
 * Get OG image for tournament
 */
export function getTournamentOGImage(tournamentId: string): string {
  return generateShareImage('tournament', tournamentId)
}

/**
 * Get OG image for player profile
 */
export function getPlayerOGImage(playerId: string): string {
  return generateShareImage('player', playerId)
}

/**
 * Get OG image for organization
 */
export function getOrganizationOGImage(orgId: string): string {
  return generateShareImage('organization', orgId)
}

// ============================================
// Platform-Specific Share URLs
// ============================================

/**
 * Generate WhatsApp share URL
 */
export function getWhatsAppShareUrl(text: string, url: string): string {
  const encodedText = encodeURIComponent(`${text}\n\n${url}`)
  return `https://wa.me/?text=${encodedText}`
}

/**
 * Generate Twitter/X share URL
 */
export function getTwitterShareUrl(text: string, url: string, hashtags?: string[]): string {
  const params = new URLSearchParams({
    text,
    url,
  })
  
  if (hashtags && hashtags.length > 0) {
    params.set('hashtags', hashtags.join(','))
  }
  
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

/**
 * Generate Facebook share URL
 */
export function getFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
}

/**
 * Generate LinkedIn share URL
 */
export function getLinkedInShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    mini: 'true',
    url,
    summary: text,
  })
  
  return `https://www.linkedin.com/shareArticle?${params.toString()}`
}

/**
 * Generate Telegram share URL
 */
export function getTelegramShareUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text: `${text}\n\n${url}`,
  })
  
  return `https://t.me/share/url?${params.toString()}`
}

/**
 * Generate email share link
 */
export function getEmailShareUrl(subject: string, body: string, url: string): string {
  const fullBody = `${body}\n\n${url}`
  const params = new URLSearchParams({
    subject,
    body: fullBody,
  })
  
  return `mailto:?${params.toString()}`
}

/**
 * Get all platform share URLs
 */
export function getAllPlatformShareUrls(shareData: ShareData): Record<SocialPlatform, string> {
  return {
    whatsapp: getWhatsAppShareUrl(shareData.title, shareData.url),
    twitter: getTwitterShareUrl(shareData.title, shareData.url, shareData.hashtags),
    facebook: getFacebookShareUrl(shareData.url),
    linkedin: getLinkedInShareUrl(shareData.description, shareData.url),
    telegram: getTelegramShareUrl(shareData.title, shareData.url),
    email: getEmailShareUrl(shareData.title, shareData.description, shareData.url),
    copy: shareData.url,
  }
}

// ============================================
// Share Tracking
// ============================================

/**
 * Track a share event for analytics
 */
export async function trackShare(
  type: ShareType,
  entityId: string,
  platform: SocialPlatform,
  metadata?: {
    ip?: string
    userAgent?: string
    referrer?: string
    shareLinkId?: string
  }
): Promise<void> {
  try {
    // Create or update share analytics record
    await db.$executeRaw`
      INSERT INTO ShareEvent (id, type, entityId, platform, ip, userAgent, referrer, shareLinkId, createdAt)
      VALUES (
        ${generateCuid()},
        ${type},
        ${entityId},
        ${platform},
        ${metadata?.ip || null},
        ${metadata?.userAgent || null},
        ${metadata?.referrer || null},
        ${metadata?.shareLinkId || null},
        ${new Date()}
      )
    `
  } catch (error) {
    // Log error but don't fail the share operation
    console.error('[Share] Failed to track share:', error)
  }
}

/**
 * Get share analytics for an entity
 */
export async function getShareAnalytics(
  type: ShareType,
  entityId: string,
  periodDays: number = 30
): Promise<ShareAnalytics> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
  
  try {
    const events = await db.$queryRaw<Array<{
      platform: string
      createdAt: Date
    }>>`
      SELECT platform, createdAt
      FROM ShareEvent
      WHERE type = ${type}
        AND entityId = ${entityId}
        AND createdAt >= ${since}
    `
    
    // Calculate totals
    const sharesByPlatform: Record<SocialPlatform, number> = {
      whatsapp: 0,
      twitter: 0,
      facebook: 0,
      linkedin: 0,
      telegram: 0,
      email: 0,
      copy: 0,
    }
    
    const sharesByDate: Map<string, number> = new Map()
    
    for (const event of events) {
      const platform = event.platform as SocialPlatform
      if (platform in sharesByPlatform) {
        sharesByPlatform[platform]++
      }
      
      const dateKey = event.createdAt.toISOString().split('T')[0]
      sharesByDate.set(dateKey, (sharesByDate.get(dateKey) || 0) + 1)
    }
    
    // Convert to array sorted by date
    const sharesOverTime = Array.from(sharesByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return {
      totalShares: events.length,
      sharesByPlatform,
      sharesOverTime,
    }
  } catch {
    // Table might not exist yet
    return {
      totalShares: 0,
      sharesByPlatform: {
        whatsapp: 0,
        twitter: 0,
        facebook: 0,
        linkedin: 0,
        telegram: 0,
        email: 0,
        copy: 0,
      },
      sharesOverTime: [],
    }
  }
}

/**
 * Get popular shared entities
 */
export async function getPopularSharedEntities(
  type: ShareType,
  limit: number = 10,
  periodDays: number = 7
): Promise<Array<{ entityId: string; shareCount: number }>> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
  
  try {
    const results = await db.$queryRaw<Array<{
      entityId: string
      count: bigint
    }>>`
      SELECT entityId, COUNT(*) as count
      FROM ShareEvent
      WHERE type = ${type}
        AND createdAt >= ${since}
      GROUP BY entityId
      ORDER BY count DESC
      LIMIT ${limit}
    `
    
    return results.map(r => ({
      entityId: r.entityId,
      shareCount: Number(r.count),
    }))
  } catch {
    return []
  }
}

// ============================================
// Entity-Specific Share Data
// ============================================

/**
 * Get share data for a tournament
 */
export async function getTournamentShareData(tournamentId: string): Promise<ShareData | null> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      sport: true,
      type: true,
      scope: true,
      location: true,
      city: true,
      state: true,
      prizePool: true,
      startDate: true,
    },
  })
  
  if (!tournament) {
    return null
  }
  
  const location = [tournament.location, tournament.city, tournament.state]
    .filter(Boolean)
    .join(', ')
  
  const sport = tournament.sport as string
  const hashtags = [
    ...(HASHTAGS[sport as keyof typeof HASHTAGS] || []),
    ...HASHTAGS.GENERAL,
  ]
  
  return {
    url: generateShareUrl('tournament', tournament.id),
    title: `🏆 ${tournament.name} - ${sport} Tournament on VALORHIVE`,
    description: `Join the ${tournament.type.toLowerCase().replace('_', ' ')} tournament with ₹${tournament.prizePool.toLocaleString()} prize pool! ${location ? `📍 ${location}` : ''}`,
    image: getTournamentOGImage(tournament.id),
    hashtags,
  }
}

/**
 * Get share data for a player profile
 */
export async function getPlayerShareData(playerId: string): Promise<ShareData | null> {
  const player = await db.user.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      sport: true,
      city: true,
      state: true,
      visiblePoints: true,
      hiddenElo: true,
    },
  })
  
  if (!player) {
    return null
  }
  
  const sport = player.sport as string
  const hashtags = [
    ...(HASHTAGS[sport as keyof typeof HASHTAGS] || []),
    ...HASHTAGS.GENERAL,
  ]
  
  const location = [player.city, player.state].filter(Boolean).join(', ')
  
  return {
    url: generateShareUrl('player', player.id),
    title: `🎯 ${player.firstName} ${player.lastName} - ${sport} Player on VALORHIVE`,
    description: `${player.visiblePoints} points | ${location ? `📍 ${location}` : ''} | View profile, stats, and tournament history.`,
    image: getPlayerOGImage(player.id),
    hashtags,
  }
}

/**
 * Get share data for an organization
 */
export async function getOrganizationShareData(orgId: string): Promise<ShareData | null> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      type: true,
      sport: true,
      city: true,
      state: true,
    },
  })
  
  if (!org) {
    return null
  }
  
  const sport = org.sport as string
  const hashtags = [
    ...(HASHTAGS[sport as keyof typeof HASHTAGS] || []),
    ...HASHTAGS.GENERAL,
  ]
  
  const location = [org.city, org.state].filter(Boolean).join(', ')
  
  return {
    url: generateShareUrl('organization', org.id),
    title: `🏢 ${org.name} - ${org.type} on VALORHIVE`,
    description: `${sport} organization${location ? ` | 📍 ${location}` : ''} | View roster, tournaments, and achievements.`,
    image: getOrganizationOGImage(org.id),
    hashtags,
  }
}

/**
 * Get share data for any entity type
 */
export async function getShareData(type: ShareType, entityId: string): Promise<ShareData | null> {
  switch (type) {
    case 'tournament':
      return getTournamentShareData(entityId)
    case 'player':
      return getPlayerShareData(entityId)
    case 'organization':
      return getOrganizationShareData(entityId)
    default:
      return null
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Copy text to clipboard (client-side only)
 */
export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return Promise.resolve(false)
  }
  
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false)
}

/**
 * Check if Web Share API is available (client-side only)
 */
export function isWebShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share
}

/**
 * Share using Web Share API (client-side only)
 */
export async function shareViaWebAPI(shareData: ShareData): Promise<boolean> {
  if (!isWebShareAvailable()) {
    return false
  }
  
  try {
    await navigator.share({
      title: shareData.title,
      text: shareData.description,
      url: shareData.url,
    })
    return true
  } catch {
    // User cancelled or error
    return false
  }
}

/**
 * Generate QR code URL for a share link
 */
export function getQRCodeUrl(url: string, size: number = 200): string {
  const encodedUrl = encodeURIComponent(url)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}`
}

// ============================================
// Export Default
// ============================================

const socialSharingService = {
  generateShareUrl,
  createShareLink,
  getShareLinkByShortCode,
  getShortUrl,
  generateShareImage,
  getWhatsAppShareUrl,
  getTwitterShareUrl,
  getFacebookShareUrl,
  getLinkedInShareUrl,
  getTelegramShareUrl,
  getEmailShareUrl,
  getAllPlatformShareUrls,
  trackShare,
  getShareAnalytics,
  getPopularSharedEntities,
  getShareData,
  getTournamentShareData,
  getPlayerShareData,
  getOrganizationShareData,
  copyToClipboard,
  isWebShareAvailable,
  shareViaWebAPI,
  getQRCodeUrl,
}

export default socialSharingService
