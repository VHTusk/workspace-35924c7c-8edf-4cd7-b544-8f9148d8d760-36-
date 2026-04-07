/**
 * VALORHIVE PWA - Background Sync Service
 * Handles offline actions that need to sync when back online
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

interface SyncAction {
  id: string;
  type: 'SCORE_ENTRY' | 'REGISTRATION' | 'PROFILE_UPDATE' | 'MATCH_RESULT';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

interface ValorhiveDB extends DBSchema {
  syncQueue: {
    key: string;
    value: SyncAction;
    indexes: { 'by-status': string; 'by-timestamp': number };
  };
}

// ============================================
// IndexedDB Setup
// ============================================

const DB_NAME = 'valorhive-sync';
const DB_VERSION = 1;

let db: IDBPDatabase<ValorhiveDB> | null = null;

async function getDB(): Promise<IDBPDatabase<ValorhiveDB>> {
  if (db) return db;

  db = await openDB<ValorhiveDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore('syncQueue', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-timestamp', 'timestamp');
    },
  });

  return db;
}

// ============================================
// Sync Queue Operations
// ============================================

export async function addToSyncQueue(
  type: SyncAction['type'],
  data: Record<string, unknown>
): Promise<string> {
  const database = await getDB();
  const id = `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const action: SyncAction = {
    id,
    type,
    data,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  await database.put('syncQueue', action);
  
  // Register for background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('valorhive-sync');
  }

  return id;
}

export async function getPendingActions(): Promise<SyncAction[]> {
  const database = await getDB();
  return database.getAllFromIndex('syncQueue', 'by-status', 'pending');
}

export async function updateActionStatus(
  id: string,
  status: SyncAction['status'],
  incrementRetry = false
): Promise<void> {
  const database = await getDB();
  const action = await database.get('syncQueue', id);
  
  if (action) {
    action.status = status;
    if (incrementRetry) {
      action.retries += 1;
    }
    await database.put('syncQueue', action);
  }
}

export async function removeAction(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('syncQueue', id);
}

export async function clearCompletedActions(): Promise<void> {
  const database = await getDB();
  const completed = await database.getAllFromIndex('syncQueue', 'by-status', 'completed');
  
  for (const action of completed) {
    await database.delete('syncQueue', action.id);
  }
}

// ============================================
// Sync Handlers
// ============================================

async function syncScoreEntry(data: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch('/api/matches/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Error syncing score entry:', error);
    return false;
  }
}

async function syncRegistration(data: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch('/api/tournaments/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Error syncing registration:', error);
    return false;
  }
}

async function syncProfileUpdate(data: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch('/api/player/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Error syncing profile update:', error);
    return false;
  }
}

async function syncMatchResult(data: Record<string, unknown>): Promise<boolean> {
  try {
    const response = await fetch('/api/matches/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error('Error syncing match result:', error);
    return false;
  }
}

// ============================================
// Main Sync Function
// ============================================

const MAX_RETRIES = 3;

export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  const pending = await getPendingActions();
  let processed = 0;
  let failed = 0;

  for (const action of pending) {
    // Mark as syncing
    await updateActionStatus(action.id, 'syncing');

    let success = false;

    switch (action.type) {
      case 'SCORE_ENTRY':
        success = await syncScoreEntry(action.data);
        break;
      case 'REGISTRATION':
        success = await syncRegistration(action.data);
        break;
      case 'PROFILE_UPDATE':
        success = await syncProfileUpdate(action.data);
        break;
      case 'MATCH_RESULT':
        success = await syncMatchResult(action.data);
        break;
    }

    if (success) {
      await updateActionStatus(action.id, 'completed');
      processed++;
    } else {
      if (action.retries >= MAX_RETRIES) {
        await updateActionStatus(action.id, 'failed');
        failed++;
      } else {
        await updateActionStatus(action.id, 'pending', true);
      }
    }
  }

  return { processed, failed };
}

// ============================================
// React Hook for Offline Actions
// ============================================

// Helper to get initial online state (called at render time)
function getInitialOnlineState(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
}

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);

  useEffect(() => {
    let mounted = true;
    
    const updatePendingCount = async () => {
      const pending = await getPendingActions();
      if (mounted) {
        setPendingCount(pending.length);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue().then(() => updatePendingCount());
    };

    const handleOffline = () => setIsOnline(false);

    // Initialize pending count
    updatePendingCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueAction = useCallback(
    async (type: SyncAction['type'], data: Record<string, unknown>) => {
      if (isOnline) {
        // Try to execute immediately if online
        let success = false;
        switch (type) {
          case 'SCORE_ENTRY':
            success = await syncScoreEntry(data);
            break;
          case 'REGISTRATION':
            success = await syncRegistration(data);
            break;
          case 'PROFILE_UPDATE':
            success = await syncProfileUpdate(data);
            break;
          case 'MATCH_RESULT':
            success = await syncMatchResult(data);
            break;
        }

        if (success) {
          return { queued: false, success: true };
        }
      }

      // Queue for later sync
      const id = await addToSyncQueue(type, data);
      setPendingCount((c) => c + 1);
      return { queued: true, success: false, id };
    },
    [isOnline]
  );

  const retryFailed = useCallback(async () => {
    const database = await getDB();
    const failed = await database.getAll('syncQueue');
    
    for (const action of failed) {
      if (action.status === 'failed') {
        action.status = 'pending';
        await database.put('syncQueue', action);
      }
    }

    return processSyncQueue();
  }, []);

  return {
    pendingCount,
    isOnline,
    queueAction,
    retryFailed,
    processSyncQueue,
  };
}

// ============================================
// Service Worker Message Handler
// ============================================

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data.type === 'SYNC_COMPLETE') {
      const pending = await getPendingActions();
      // Dispatch custom event for components to react
      window.dispatchEvent(
        new CustomEvent('valorhive-sync', {
          detail: { pendingCount: pending.length },
        })
      );
    }
  });
}

// Export types for use in other files
export type { SyncAction };
