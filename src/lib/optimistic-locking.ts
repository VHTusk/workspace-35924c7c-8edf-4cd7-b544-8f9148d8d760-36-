/**
 * Optimistic Locking Utilities
 * 
 * Provides version-based concurrency control for preventing lost updates
 * when multiple clients try to modify the same record simultaneously.
 */

import { Prisma } from '@prisma/client'
import { db } from './db'

// ============================================
// Error Classes
// ============================================

/**
 * Error thrown when an optimistic lock conflict is detected
 */
export class OptimisticLockError extends Error {
  public readonly entityType: string
  public readonly entityId: string
  public readonly expectedVersion: number
  public readonly actualVersion: number | null

  constructor(
    entityType: string,
    entityId: string,
    expectedVersion: number,
    actualVersion: number | null
  ) {
    super(
      `Optimistic lock conflict on ${entityType}(${entityId}): ` +
      `expected version ${expectedVersion}, but found ${actualVersion ?? 'no record'}`
    )
    this.name = 'OptimisticLockError'
    this.entityType = entityType
    this.entityId = entityId
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }

  /**
   * Whether the conflict was due to the record being deleted
   */
  get isDeleted(): boolean {
    return this.actualVersion === null
  }

  /**
   * Whether another client modified the record first
   */
  get isModified(): boolean {
    return this.actualVersion !== null && this.actualVersion > this.expectedVersion
  }
}

/**
 * Error thrown when version check fails during update
 */
export class VersionMismatchError extends OptimisticLockError {
  constructor(
    entityType: string,
    entityId: string,
    expectedVersion: number,
    actualVersion: number
  ) {
    super(entityType, entityId, expectedVersion, actualVersion)
    this.name = 'VersionMismatchError'
  }
}

/**
 * Error thrown when record not found during version check
 */
export class RecordNotFoundError extends OptimisticLockError {
  constructor(entityType: string, entityId: string, expectedVersion: number) {
    super(entityType, entityId, expectedVersion, null)
    this.name = 'RecordNotFoundError'
  }
}

// ============================================
// Types
// ============================================

export interface VersionedUpdateResult<T> {
  success: boolean
  data?: T
  newVersion?: number
  error?: OptimisticLockError | Error
}

export interface VersionCheckResult {
  valid: boolean
  currentVersion: number | null
  error?: OptimisticLockError
}

// Models that support optimistic locking (have rowVersion field)
export type VersionedModel = 'Match' | 'BracketMatch'

// ============================================
// Version Checking Utilities
// ============================================

/**
 * Check if a record exists and has the expected version
 * 
 * @param model - The Prisma model name
 * @param id - The record ID
 * @param expectedVersion - The expected version number
 * @returns Version check result
 */
export async function checkVersion(
  model: VersionedModel,
  id: string,
  expectedVersion: number
): Promise<VersionCheckResult> {
  try {
    let record: { rowVersion: number } | null = null
    
    switch (model) {
      case 'Match':
        record = await db.match.findUnique({
          where: { id },
          select: { rowVersion: true },
        })
        break
      case 'BracketMatch':
        record = await db.bracketMatch.findUnique({
          where: { id },
          select: { rowVersion: true },
        })
        break
      default:
        throw new Error(`Unsupported versioned model: ${model}`)
    }
    
    if (!record) {
      return {
        valid: false,
        currentVersion: null,
        error: new RecordNotFoundError(model, id, expectedVersion),
      }
    }
    
    if (record.rowVersion !== expectedVersion) {
      return {
        valid: false,
        currentVersion: record.rowVersion,
        error: new VersionMismatchError(model, id, expectedVersion, record.rowVersion),
      }
    }
    
    return {
      valid: true,
      currentVersion: record.rowVersion,
    }
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return {
        valid: false,
        currentVersion: null,
        error,
      }
    }
    
    return {
      valid: false,
      currentVersion: null,
      error: new OptimisticLockError(model, id, expectedVersion, null),
    }
  }
}

/**
 * Check version for multiple records at once
 * 
 * @param checks - Array of version checks to perform
 * @returns Array of version check results
 */
export async function checkVersions(
  checks: Array<{ model: VersionedModel; id: string; expectedVersion: number }>
): Promise<Map<string, VersionCheckResult>> {
  const results = new Map<string, VersionCheckResult>()
  
  await Promise.all(
    checks.map(async ({ model, id, expectedVersion }) => {
      const result = await checkVersion(model, id, expectedVersion)
      results.set(`${model}:${id}`, result)
    })
  )
  
  return results
}

// ============================================
// Versioned Update Utilities
// ============================================

/**
 * Update a record with optimistic locking
 * Automatically increments the version on successful update
 * 
 * @param model - The Prisma model name
 * @param id - The record ID
 * @param expectedVersion - The expected current version
 * @param updateData - The data to update
 * @returns Update result with new version or error
 */
export async function updateWithVersion<T extends Record<string, unknown>>(
  model: VersionedModel,
  id: string,
  expectedVersion: number,
  updateData: T
): Promise<VersionedUpdateResult<unknown>> {
  try {
    // First check the version
    const versionCheck = await checkVersion(model, id, expectedVersion)
    
    if (!versionCheck.valid) {
      return {
        success: false,
        error: versionCheck.error,
      }
    }
    
    // Perform the update with version increment
    const newVersion = expectedVersion + 1
    let updated: { id: string; rowVersion: number }
    
    switch (model) {
      case 'Match':
        updated = await db.match.update({
          where: { id },
          data: {
            ...updateData,
            rowVersion: newVersion,
          } as never,
          select: { id: true, rowVersion: true },
        })
        break
      case 'BracketMatch':
        updated = await db.bracketMatch.update({
          where: { id },
          data: {
            ...updateData,
            rowVersion: newVersion,
          } as never,
          select: { id: true, rowVersion: true },
        })
        break
      default:
        throw new Error(`Unsupported versioned model: ${model}`)
    }
    
    return {
      success: true,
      data: updated,
      newVersion: updated.rowVersion,
    }
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return {
        success: false,
        error,
      }
    }
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma-specific errors
      if (error.code === 'P2025') {
        // Record not found
        return {
          success: false,
          error: new RecordNotFoundError(model, id, expectedVersion),
        }
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Update with automatic retry on version conflict
 * Fetches the latest version and retries the update
 * 
 * @param model - The Prisma model name
 * @param id - The record ID
 * @param updateFn - Function that receives current data and returns update data
 * @param maxRetries - Maximum number of retry attempts
 * @returns Update result with new version or error
 */
export async function updateWithRetry<T extends Record<string, unknown>>(
  model: VersionedModel,
  id: string,
  updateFn: (currentData: unknown) => Promise<T> | T,
  maxRetries: number = 3
): Promise<VersionedUpdateResult<unknown>> {
  let attempts = 0
  
  while (attempts < maxRetries) {
    attempts++
    
    // Fetch current record with version
    let current: { id: string; rowVersion: number } | null = null
    
    switch (model) {
      case 'Match':
        current = await db.match.findUnique({
          where: { id },
        }) as { id: string; rowVersion: number } | null
        break
      case 'BracketMatch':
        current = await db.bracketMatch.findUnique({
          where: { id },
        }) as { id: string; rowVersion: number } | null
        break
    }
    
    if (!current) {
      return {
        success: false,
        error: new RecordNotFoundError(model, id, 0),
      }
    }
    
    // Get update data from the update function
    const updateData = await updateFn(current)
    
    // Attempt the update
    const result = await updateWithVersion(model, id, current.rowVersion, updateData)
    
    if (result.success) {
      return result
    }
    
    // If it's a version mismatch, retry
    if (result.error instanceof VersionMismatchError) {
      continue
    }
    
    // For other errors, return immediately
    return result
  }
  
  return {
    success: false,
    error: new Error(`Failed to update ${model}(${id}) after ${maxRetries} attempts`),
  }
}

// ============================================
// Conditional Update Utilities
// ============================================

/**
 * Update a record only if a condition is met
 * Uses Prisma's conditional update feature
 * 
 * @param model - The Prisma model name
 * @param id - The record ID
 * @param condition - The condition that must be true for update
 * @param updateData - The data to update
 * @returns Update result
 */
export async function conditionalUpdate<T extends Record<string, unknown>>(
  model: VersionedModel,
  id: string,
  condition: Record<string, unknown>,
  updateData: T
): Promise<VersionedUpdateResult<unknown>> {
  try {
    let updated: { id: string; rowVersion: number } | null = null
    
    switch (model) {
      case 'Match':
        updated = await db.match.updateMany({
          where: {
            id,
            ...condition,
          },
          data: {
            ...updateData,
            rowVersion: { increment: 1 },
          } as never,
        }).then(async () => {
          return db.match.findUnique({
            where: { id },
            select: { id: true, rowVersion: true },
          })
        })
        break
      case 'BracketMatch':
        updated = await db.bracketMatch.updateMany({
          where: {
            id,
            ...condition,
          },
          data: {
            ...updateData,
            rowVersion: { increment: 1 },
          } as never,
        }).then(async () => {
          return db.bracketMatch.findUnique({
            where: { id },
            select: { id: true, rowVersion: true },
          })
        })
        break
      default:
        throw new Error(`Unsupported versioned model: ${model}`)
    }
    
    if (!updated) {
      return {
        success: false,
        error: new Error('Condition not met or record not found'),
      }
    }
    
    return {
      success: true,
      data: updated,
      newVersion: updated.rowVersion,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

// ============================================
// Batch Versioned Operations
// ============================================

/**
 * Perform multiple versioned updates in a transaction
 * All updates must succeed or all will fail
 * 
 * @param operations - Array of versioned update operations
 * @returns Array of update results
 */
export async function batchVersionedUpdate(
  operations: Array<{
    model: VersionedModel
    id: string
    expectedVersion: number
    updateData: Record<string, unknown>
  }>
): Promise<VersionedUpdateResult<unknown[]>> {
  try {
    const results = await db.$transaction(async (tx) => {
      const updatedRecords: unknown[] = []
      
      for (const op of operations) {
        // Check version first
        let current: { rowVersion: number } | null = null
        
        switch (op.model) {
          case 'Match':
            current = await tx.match.findUnique({
              where: { id: op.id },
              select: { rowVersion: true },
            })
            break
          case 'BracketMatch':
            current = await tx.bracketMatch.findUnique({
              where: { id: op.id },
              select: { rowVersion: true },
            })
            break
        }
        
        if (!current) {
          throw new RecordNotFoundError(op.model, op.id, op.expectedVersion)
        }
        
        if (current.rowVersion !== op.expectedVersion) {
          throw new VersionMismatchError(
            op.model,
            op.id,
            op.expectedVersion,
            current.rowVersion
          )
        }
        
        // Perform update
        const newVersion = op.expectedVersion + 1
        
        switch (op.model) {
          case 'Match':
            await tx.match.update({
              where: { id: op.id },
              data: {
                ...op.updateData,
                rowVersion: newVersion,
              } as never,
            })
            break
          case 'BracketMatch':
            await tx.bracketMatch.update({
              where: { id: op.id },
              data: {
                ...op.updateData,
                rowVersion: newVersion,
              } as never,
            })
            break
        }
        
        updatedRecords.push({ id: op.id, newVersion })
      }
      
      return updatedRecords
    })
    
    return {
      success: true,
      data: results,
    }
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return {
        success: false,
        error,
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

// ============================================
// Version Comparison Utilities
// ============================================

/**
 * Compare two versions to detect conflict
 */
export function detectVersionConflict(
  clientVersion: number,
  serverVersion: number
): {
  hasConflict: boolean
  conflictType: 'NONE' | 'STALE' | 'MODIFIED' | 'DELETED'
} {
  if (clientVersion === serverVersion) {
    return { hasConflict: false, conflictType: 'NONE' }
  }
  
  if (clientVersion < serverVersion) {
    return { hasConflict: true, conflictType: 'STALE' }
  }
  
  // clientVersion > serverVersion should not happen normally
  return { hasConflict: true, conflictType: 'MODIFIED' }
}

/**
 * Get version status for client synchronization
 */
export async function getVersionStatus(
  model: VersionedModel,
  ids: string[]
): Promise<Map<string, { version: number; exists: boolean }>> {
  const statusMap = new Map<string, { version: number; exists: boolean }>()
  
  await Promise.all(
    ids.map(async (id) => {
      let record: { rowVersion: number } | null = null
      
      switch (model) {
        case 'Match':
          record = await db.match.findUnique({
            where: { id },
            select: { rowVersion: true },
          })
          break
        case 'BracketMatch':
          record = await db.bracketMatch.findUnique({
            where: { id },
            select: { rowVersion: true },
          })
          break
      }
      
      statusMap.set(id, {
        version: record?.rowVersion ?? 0,
        exists: record !== null,
      })
    })
  )
  
  return statusMap
}

// ============================================
// Export convenience functions
// ============================================

export const optimisticLocking = {
  checkVersion,
  checkVersions,
  updateWithVersion,
  updateWithRetry,
  conditionalUpdate,
  batchVersionedUpdate,
  detectVersionConflict,
  getVersionStatus,
  OptimisticLockError,
  VersionMismatchError,
  RecordNotFoundError,
}

export default optimisticLocking
