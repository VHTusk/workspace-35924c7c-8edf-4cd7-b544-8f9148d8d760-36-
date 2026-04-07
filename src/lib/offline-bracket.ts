/**
 * Offline Bracket Storage
 * 
 * Provides offline-first bracket management for tournament directors.
 * Stores bracket data in localStorage and syncs when connection is restored.
 * 
 * Use cases:
 * - Tournament venue has poor internet
 * - Tablet devices used for score entry
 * - Power outages during tournaments
 */

import { BracketMatchStatus, BracketSide } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface OfflineBracketMatch {
  id: string;
  bracketId: string;
  roundNumber: number;
  matchNumber: number;
  playerAId: string | null;
  playerBId: string | null;
  playerAName: string | null;
  playerBName: string | null;
  winnerId: string | null;
  status: BracketMatchStatus;
  bracketSide?: BracketSide;
  scheduledAt?: string;
  courtAssignment?: string;
  scoreA?: number;
  scoreB?: number;
  
  // Offline tracking
  offlineModified?: boolean;
  offlineModifiedAt?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

interface OfflineBracket {
  id: string;
  tournamentId: string;
  tournamentName: string;
  format: string;
  totalRounds: number;
  matches: OfflineBracketMatch[];
  
  // Offline metadata
  downloadedAt: string;
  lastSyncedAt?: string;
  isOfflineMode: boolean;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

const STORAGE_KEY = 'valorhive_offline_brackets';
const SYNC_QUEUE_KEY = 'valorhive_sync_queue';

// ============================================
// STORAGE FUNCTIONS
// ============================================

/**
 * Save bracket to offline storage
 */
export function saveOfflineBracket(bracket: OfflineBracket): void {
  if (typeof window === 'undefined') return;
  
  const brackets = getStoredBrackets();
  const existingIndex = brackets.findIndex(b => b.tournamentId === bracket.tournamentId);
  
  if (existingIndex >= 0) {
    brackets[existingIndex] = bracket;
  } else {
    brackets.push(bracket);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(brackets));
}

/**
 * Get all stored brackets
 */
export function getStoredBrackets(): OfflineBracket[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get bracket by tournament ID
 */
export function getOfflineBracket(tournamentId: string): OfflineBracket | null {
  const brackets = getStoredBrackets();
  return brackets.find(b => b.tournamentId === tournamentId) || null;
}

/**
 * Remove bracket from offline storage
 */
export function removeOfflineBracket(tournamentId: string): void {
  if (typeof window === 'undefined') return;
  
  const brackets = getStoredBrackets().filter(b => b.tournamentId !== tournamentId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(brackets));
}

/**
 * Clear all offline data
 */
export function clearOfflineData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

// ============================================
// OFFLINE MATCH OPERATIONS
// ============================================

/**
 * Update match score offline
 */
export function updateOfflineMatchScore(
  tournamentId: string,
  matchId: string,
  scoreA: number,
  scoreB: number,
  winnerId: string
): OfflineBracket | null {
  const bracket = getOfflineBracket(tournamentId);
  if (!bracket) return null;
  
  const matchIndex = bracket.matches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return null;
  
  const match = bracket.matches[matchIndex];
  
  bracket.matches[matchIndex] = {
    ...match,
    scoreA,
    scoreB,
    winnerId,
    status: BracketMatchStatus.COMPLETED,
    offlineModified: true,
    offlineModifiedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };
  
  bracket.lastSyncedAt = new Date().toISOString();
  bracket.isOfflineMode = true;
  
  saveOfflineBracket(bracket);
  
  // Add to sync queue
  addToSyncQueue({
    type: 'match_result',
    tournamentId,
    matchId,
    data: { scoreA, scoreB, winnerId },
    timestamp: new Date().toISOString(),
  });
  
  return bracket;
}

/**
 * Advance player in bracket (offline)
 */
export function advanceOfflinePlayer(
  tournamentId: string,
  matchId: string,
  winnerId: string
): OfflineBracket | null {
  const bracket = getOfflineBracket(tournamentId);
  if (!bracket) return null;
  
  const matchIndex = bracket.matches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return null;
  
  const match = bracket.matches[matchIndex];
  
  // Update current match
  bracket.matches[matchIndex] = {
    ...match,
    winnerId,
    status: BracketMatchStatus.COMPLETED,
    offlineModified: true,
    offlineModifiedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };
  
  // Find next match and advance winner
  const nextMatch = bracket.matches.find(
    m => m.roundNumber === match.roundNumber + 1 && m.status === BracketMatchStatus.PENDING
  );
  
  if (nextMatch) {
    const nextMatchIndex = bracket.matches.findIndex(m => m.id === nextMatch.id);
    
    if (!nextMatch.playerAId) {
      bracket.matches[nextMatchIndex].playerAId = winnerId;
      bracket.matches[nextMatchIndex].playerAName = 
        match.playerAId === winnerId ? match.playerAName : match.playerBName;
    } else {
      bracket.matches[nextMatchIndex].playerBId = winnerId;
      bracket.matches[nextMatchIndex].playerBName = 
        match.playerAId === winnerId ? match.playerAName : match.playerBName;
    }
    
    bracket.matches[nextMatchIndex].offlineModified = true;
    bracket.matches[nextMatchIndex].syncStatus = 'pending';
  }
  
  bracket.isOfflineMode = true;
  saveOfflineBracket(bracket);
  
  addToSyncQueue({
    type: 'advance_player',
    tournamentId,
    matchId,
    data: { winnerId },
    timestamp: new Date().toISOString(),
  });
  
  return bracket;
}

/**
 * Set court assignment (offline)
 */
export function setOfflineCourtAssignment(
  tournamentId: string,
  matchId: string,
  court: string
): OfflineBracket | null {
  const bracket = getOfflineBracket(tournamentId);
  if (!bracket) return null;
  
  const matchIndex = bracket.matches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return null;
  
  bracket.matches[matchIndex].courtAssignment = court;
  bracket.matches[matchIndex].offlineModified = true;
  bracket.matches[matchIndex].syncStatus = 'pending';
  
  bracket.isOfflineMode = true;
  saveOfflineBracket(bracket);
  
  return bracket;
}

// ============================================
// SYNC QUEUE
// ============================================

interface SyncQueueItem {
  type: 'match_result' | 'advance_player' | 'court_assignment';
  tournamentId: string;
  matchId: string;
  data: Record<string, unknown>;
  timestamp: string;
  attempts?: number;
  lastAttempt?: string;
  error?: string;
}

/**
 * Add item to sync queue
 */
function addToSyncQueue(item: SyncQueueItem): void {
  if (typeof window === 'undefined') return;
  
  try {
    const queue = getSyncQueue();
    queue.push({ ...item, attempts: 0 });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
  }
}

/**
 * Get sync queue
 */
export function getSyncQueue(): SyncQueueItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Clear sync queue
 */
function clearSyncQueue(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

// ============================================
// ONLINE SYNC
// ============================================

/**
 * Sync offline changes to server
 * Call this when connection is restored
 */
export async function syncToServer(tournamentId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    conflicts: 0,
    errors: [],
  };
  
  const bracket = getOfflineBracket(tournamentId);
  if (!bracket) {
    result.success = false;
    result.errors.push('No offline bracket found');
    return result;
  }
  
  const pendingMatches = bracket.matches.filter(m => m.syncStatus === 'pending');
  
  for (const match of pendingMatches) {
    try {
      const response = await fetch('/api/admin/override/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force_advance',
          bracketMatchId: match.id,
          playerId: match.winnerId,
          reason: 'Offline sync',
        }),
      });
      
      if (response.ok) {
        match.syncStatus = 'synced';
        match.offlineModified = false;
        result.synced++;
      } else {
        const error = await response.json();
        match.syncStatus = 'failed';
        result.failed++;
        result.errors.push(`Match ${match.matchNumber}: ${error.error || 'Sync failed'}`);
      }
    } catch (error) {
      match.syncStatus = 'failed';
      result.failed++;
      result.errors.push(`Match ${match.matchNumber}: Network error`);
    }
  }
  
  // Update storage
  saveOfflineBracket(bracket);
  
  // Clear sync queue if all synced
  if (result.failed === 0) {
    clearSyncQueue();
  }
  
  result.success = result.failed === 0;
  return result;
}

/**
 * Check if offline mode is needed
 */
export function isOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  return !navigator.onLine;
}

/**
 * Register online/offline event listeners
 */
export function setupOfflineListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleOnline = () => {
    console.log('Connection restored');
    onOnline?.();
  };
  
  const handleOffline = () => {
    console.log('Connection lost - entering offline mode');
    onOffline?.();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate storage size used by offline data
 */
export function getOfflineStorageSize(): { used: number; available: number } {
  if (typeof window === 'undefined') return { used: 0, available: 0 };
  
  let used = 0;
  for (const key of [STORAGE_KEY, SYNC_QUEUE_KEY]) {
    const item = localStorage.getItem(key);
    if (item) {
      used += item.length * 2; // UTF-16 characters
    }
  }
  
  // localStorage typically has 5-10MB limit
  const available = 5 * 1024 * 1024 - used;
  
  return { used, available };
}

/**
 * Export offline data as JSON (for backup)
 */
export function exportOfflineData(): string {
  const data = {
    brackets: getStoredBrackets(),
    syncQueue: getSyncQueue(),
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Import offline data from JSON
 */
export function importOfflineData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    
    if (data.brackets) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.brackets));
    }
    
    if (data.syncQueue) {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(data.syncQueue));
    }
    
    return true;
  } catch {
    return false;
  }
}
