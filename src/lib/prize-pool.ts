/**
 * Prize Pool & Reward System Library
 * Handles prize distribution setup, calculation, and payout management
 */

import { db } from '@/lib/db'
import { Prisma, PayoutStatus, SportType } from '@prisma/client'

// Types
export interface PrizeDistributionInput {
  position: number
  percentage: number
  description?: string
  isMonetary?: boolean
}

export interface PrizeDistributionOutput {
  id: string
  tournamentId: string
  position: number
  percentage: number
  amount: number
  description: string | null
  isMonetary: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PayoutInput {
  userId?: string
  teamId?: string
  position: number
  amount: number
  payoutMethod?: string
}

export interface PayoutOutput {
  id: string
  tournamentId: string
  userId: string | null
  teamId: string | null
  position: number
  amount: number
  status: PayoutStatus
  payoutMethod: string | null
  transactionRef: string | null
  paidAt: Date | null
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
  } | null
  team?: {
    id: string
    name: string
  } | null
  tournament?: {
    id: string
    name: string
    sport: string
    prizePool: number
  }
}

export interface TournamentResult {
  position: number
  userId?: string
  teamId?: string
}

export interface PayoutUpdateDetails {
  status?: PayoutStatus
  payoutMethod?: string
  transactionRef?: string
  paidAt?: Date
}

/**
 * Create prize distribution for a tournament
 */
export async function createPrizeDistribution(
  tournamentId: string,
  distributions: PrizeDistributionInput[]
): Promise<PrizeDistributionOutput[]> {
  // Get tournament to validate and get prize pool
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { prizePool: true },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // Validate total percentage equals 100
  const totalPercentage = distributions.reduce((sum, d) => sum + d.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Total percentage must equal 100%. Current total: ${totalPercentage}%`)
  }

  // Delete existing distributions
  await db.prizeDistribution.deleteMany({
    where: { tournamentId },
  })

  // Create new distributions with calculated amounts
  const prizeDistributions = await db.$transaction(
    distributions.map((d) =>
      db.prizeDistribution.create({
        data: {
          tournamentId,
          position: d.position,
          percentage: d.percentage,
          amount: (tournament.prizePool * d.percentage) / 100,
          description: d.description,
          isMonetary: d.isMonetary ?? true,
        },
      })
    )
  )

  return prizeDistributions
}

/**
 * Get prize distribution for a tournament
 */
export async function getPrizeDistribution(tournamentId: string): Promise<PrizeDistributionOutput[]> {
  const distributions = await db.prizeDistribution.findMany({
    where: { tournamentId },
    orderBy: { position: 'asc' },
  })

  return distributions
}

/**
 * Calculate prizes from pool based on distribution
 */
export async function calculatePrizes(tournamentId: string): Promise<{
  tournamentId: string
  prizePool: number
  distributions: PrizeDistributionOutput[]
}> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      prizeDistributions: {
        orderBy: { position: 'asc' },
      },
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  // If no distribution exists, create a default one
  if (tournament.prizeDistributions.length === 0 && tournament.prizePool > 0) {
    // Default distribution: 1st=50%, 2nd=30%, 3rd=20%
    const defaultDistributions: PrizeDistributionInput[] = [
      { position: 1, percentage: 50, description: 'Winner' },
      { position: 2, percentage: 30, description: 'Runner-up' },
      { position: 3, percentage: 20, description: 'Third Place' },
    ]
    
    const distributions = await createPrizeDistribution(tournamentId, defaultDistributions)
    
    return {
      tournamentId,
      prizePool: tournament.prizePool,
      distributions,
    }
  }

  return {
    tournamentId,
    prizePool: tournament.prizePool,
    distributions: tournament.prizeDistributions,
  }
}

/**
 * Create payouts after tournament completion
 */
export async function createPayouts(
  tournamentId: string,
  results: TournamentResult[]
): Promise<{
  success: boolean
  payouts: PayoutOutput[]
  errors: string[]
}> {
  const errors: string[] = []
  const payouts: PayoutOutput[] = []

  // Get tournament and distributions
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      prizeDistributions: {
        orderBy: { position: 'asc' },
      },
    },
  })

  if (!tournament) {
    throw new Error('Tournament not found')
  }

  if (tournament.prizeDistributions.length === 0) {
    // Calculate default prizes
    await calculatePrizes(tournamentId)
  }

  // Get fresh distributions
  const distributions = await db.prizeDistribution.findMany({
    where: { tournamentId },
    orderBy: { position: 'asc' },
  })

  // Create payouts for each result
  for (const result of results) {
    const distribution = distributions.find((d) => d.position === result.position)
    
    if (!distribution) {
      errors.push(`No distribution found for position ${result.position}`)
      continue
    }

    if (!distribution.isMonetary) {
      // Non-monetary prize - skip payout creation
      continue
    }

    // Check if payout already exists
    const existingPayout = await db.prizePayout.findFirst({
      where: {
        tournamentId,
        position: result.position,
        OR: [
          { userId: result.userId },
          { teamId: result.teamId },
        ],
      },
    })

    if (existingPayout) {
      errors.push(`Payout already exists for position ${result.position}`)
      continue
    }

    // Create payout
    const payout = await db.prizePayout.create({
      data: {
        tournamentId,
        userId: result.userId,
        teamId: result.teamId,
        position: result.position,
        amount: distribution.amount,
        status: 'PENDING' as PayoutStatus,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    payouts.push(payout as PayoutOutput)
  }

  return {
    success: errors.length === 0,
    payouts,
    errors,
  }
}

/**
 * Update payout status
 */
export async function updatePayoutStatus(
  payoutId: string,
  status: PayoutStatus,
  details?: PayoutUpdateDetails
): Promise<PayoutOutput> {
  const updateData: {
    status: PayoutStatus
    payoutMethod?: string
    transactionRef?: string
    paidAt?: Date
  } = { status }

  if (details?.payoutMethod) {
    updateData.payoutMethod = details.payoutMethod
  }

  if (details?.transactionRef) {
    updateData.transactionRef = details.transactionRef
  }

  if (status === 'COMPLETED') {
    updateData.paidAt = details?.paidAt ?? new Date()
  }

  const payout = await db.prizePayout.update({
    where: { id: payoutId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      tournament: {
        select: {
          id: true,
          name: true,
          sport: true,
          prizePool: true,
        },
      },
    },
  })

  return payout as PayoutOutput
}

/**
 * Get all payouts for a tournament
 */
export async function getTournamentPayouts(tournamentId: string): Promise<PayoutOutput[]> {
  const payouts = await db.prizePayout.findMany({
    where: { tournamentId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      tournament: {
        select: {
          id: true,
          name: true,
          sport: true,
          prizePool: true,
        },
      },
    },
    orderBy: { position: 'asc' },
  })

  return payouts as PayoutOutput[]
}

/**
 * Get all payouts with filtering (for admin)
 */
export async function getPayouts(params: {
  status?: PayoutStatus
  tournamentId?: string
  sport?: SportType
  limit?: number
  offset?: number
}): Promise<{
  payouts: PayoutOutput[]
  total: number
  summary: {
    totalAmount: number
    pendingCount: number
    processingCount: number
    completedCount: number
    failedCount: number
    cancelledCount: number
  }
}> {
  const { status, tournamentId, sport, limit = 50, offset = 0 } = params

  // Build where clause
  const where: Prisma.PrizePayoutWhereInput = {}

  if (status) {
    where.status = status
  }

  if (tournamentId) {
    where.tournamentId = tournamentId
  }

  if (sport) {
    where.tournament = { is: { sport } }
  }

  // Get payouts
  const [payouts, total] = await Promise.all([
    db.prizePayout.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            sport: true,
            prizePool: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    db.prizePayout.count({ where }),
  ])

  // Get summary statistics
  const summaryData = await db.prizePayout.aggregate({
    where: tournamentId ? { tournamentId } : sport ? { tournament: { is: { sport } } } : undefined,
    _sum: {
      amount: true,
    },
    _count: {
      _all: true,
    },
  })

  // Get counts by status
  const statusCounts = await db.prizePayout.groupBy({
    by: ['status'],
    where: tournamentId ? { tournamentId } : sport ? { tournament: { is: { sport } } } : undefined,
    _count: {
      status: true,
    },
  })

  const statusMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  ) as Record<PayoutStatus, number>

  return {
    payouts: payouts as PayoutOutput[],
    total,
    summary: {
      totalAmount: summaryData._sum.amount ?? 0,
      pendingCount: statusMap.PENDING ?? 0,
      processingCount: statusMap.PROCESSING ?? 0,
      completedCount: statusMap.COMPLETED ?? 0,
      failedCount: statusMap.FAILED ?? 0,
      cancelledCount: statusMap.CANCELLED ?? 0,
    },
  }
}

/**
 * Export payouts to CSV format
 */
export async function exportPayoutsCsv(tournamentId: string): Promise<string> {
  const payouts = await getTournamentPayouts(tournamentId)

  if (payouts.length === 0) {
    return 'No payouts found for this tournament'
  }

  // CSV headers
  const headers = [
    'Position',
    'Recipient Type',
    'Recipient Name',
    'Email',
    'Phone',
    'Amount',
    'Status',
    'Payout Method',
    'Transaction Reference',
    'Paid At',
    'Created At',
  ]

  // CSV rows
  const rows = payouts.map((payout) => {
    const recipientType = payout.userId ? 'Player' : 'Team'
    const recipientName = payout.user
      ? `${payout.user.firstName} ${payout.user.lastName}`
      : payout.team?.name ?? 'Unknown'
    const email = payout.user?.email ?? ''
    const phone = payout.user?.phone ?? ''

    return [
      payout.position,
      recipientType,
      recipientName,
      email,
      phone,
      payout.amount.toFixed(2),
      payout.status,
      payout.payoutMethod ?? '',
      payout.transactionRef ?? '',
      payout.paidAt ? new Date(payout.paidAt).toISOString() : '',
      new Date(payout.createdAt).toISOString(),
    ]
  })

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  return csv
}

/**
 * Get payout by ID
 */
export async function getPayoutById(payoutId: string): Promise<PayoutOutput | null> {
  const payout = await db.prizePayout.findUnique({
    where: { id: payoutId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      tournament: {
        select: {
          id: true,
          name: true,
          sport: true,
          prizePool: true,
        },
      },
    },
  })

  return payout as PayoutOutput | null
}

/**
 * Bulk update payout status
 */
export async function bulkUpdatePayoutStatus(
  payoutIds: string[],
  status: PayoutStatus,
  details?: { payoutMethod?: string; transactionRef?: string }
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let success = 0
  let failed = 0

  for (const payoutId of payoutIds) {
    try {
      await updatePayoutStatus(payoutId, status, details)
      success++
    } catch (error) {
      failed++
      errors.push(`Failed to update payout ${payoutId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { success, failed, errors }
}

/**
 * Delete prize distribution for a tournament
 */
export async function deletePrizeDistribution(tournamentId: string): Promise<void> {
  await db.prizeDistribution.deleteMany({
    where: { tournamentId },
  })
}

/**
 * Get default distribution template
 */
export function getDefaultDistribution(): PrizeDistributionInput[] {
  return [
    { position: 1, percentage: 50, description: 'Winner', isMonetary: true },
    { position: 2, percentage: 30, description: 'Runner-up', isMonetary: true },
    { position: 3, percentage: 20, description: 'Third Place', isMonetary: true },
  ]
}

/**
 * Get distribution templates by scope
 */
export function getDistributionByScope(scope: string): PrizeDistributionInput[] {
  switch (scope) {
    case 'NATIONAL':
      return [
        { position: 1, percentage: 35, description: 'National Champion' },
        { position: 2, percentage: 25, description: 'Runner-up' },
        { position: 3, percentage: 15, description: 'Third Place' },
        { position: 4, percentage: 10, description: 'Fourth Place' },
        { position: 5, percentage: 5, description: 'Quarter-finalist' },
        { position: 6, percentage: 5, description: 'Quarter-finalist' },
        { position: 7, percentage: 3, description: 'Quarter-finalist' },
        { position: 8, percentage: 2, description: 'Quarter-finalist' },
      ]
    case 'STATE':
      return [
        { position: 1, percentage: 45, description: 'State Champion' },
        { position: 2, percentage: 30, description: 'Runner-up' },
        { position: 3, percentage: 15, description: 'Third Place' },
        { position: 4, percentage: 10, description: 'Fourth Place' },
      ]
    case 'DISTRICT':
      return [
        { position: 1, percentage: 50, description: 'District Champion' },
        { position: 2, percentage: 30, description: 'Runner-up' },
        { position: 3, percentage: 20, description: 'Third Place' },
      ]
    case 'CITY':
    default:
      return getDefaultDistribution()
  }
}
