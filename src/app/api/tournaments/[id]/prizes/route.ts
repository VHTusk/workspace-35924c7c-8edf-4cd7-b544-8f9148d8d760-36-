import { NextRequest, NextResponse } from 'next/server'
import {
  getPrizeDistribution,
  createPrizeDistribution,
  calculatePrizes,
  getTournamentPayouts,
  PrizeDistributionInput,
} from '@/lib/prize-pool'
import { db } from '@/lib/db'
import { apiResponse, apiError, ApiErrorCodes } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/tournaments/[id]/prizes
 * Get prize distribution and payouts for a tournament
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const include = searchParams.get('include') // 'distribution', 'payouts', or 'all'

    // Get tournament basic info
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        prizePool: true,
        status: true,
        sport: true,
      },
    })

    if (!tournament) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Tournament not found', undefined, 404)
    }

    const response: {
      tournament: typeof tournament
      distribution?: Awaited<ReturnType<typeof getPrizeDistribution>>
      payouts?: Awaited<ReturnType<typeof getTournamentPayouts>>
    } = { tournament }

    if (include === 'distribution' || include === 'all' || !include) {
      response.distribution = await getPrizeDistribution(id)
    }

    if (include === 'payouts' || include === 'all') {
      response.payouts = await getTournamentPayouts(id)
    }

    return apiResponse(response)
  } catch (error) {
    console.error('Error fetching prize data:', error)
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch prize data',
      undefined,
      500
    )
  }
}

/**
 * POST /api/tournaments/[id]/prizes
 * Create or update prize distribution for a tournament
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        prizePool: true,
        status: true,
      },
    })

    if (!tournament) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Tournament not found', undefined, 404)
    }

    // Check if tournament can have prize distribution modified
    if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') {
      return apiError(
        ApiErrorCodes.CONFLICT,
        'Cannot modify prize distribution for completed or cancelled tournaments',
        undefined,
        400
      )
    }

    // Validate distribution data
    const { distributions, useTemplate } = body as {
      distributions?: PrizeDistributionInput[]
      useTemplate?: string // 'default', 'NATIONAL', 'STATE', 'DISTRICT', 'CITY'
    }

    if (!distributions && !useTemplate) {
      return apiError(ApiErrorCodes.MISSING_FIELD, 'Either distributions or useTemplate is required', undefined, 400)
    }

    // Import template function
    const { getDistributionByScope, getDefaultDistribution } = await import('@/lib/prize-pool')

    let finalDistributions: PrizeDistributionInput[]

    if (useTemplate) {
      if (useTemplate === 'default') {
        finalDistributions = getDefaultDistribution()
      } else {
        finalDistributions = getDistributionByScope(useTemplate)
      }
    } else if (distributions) {
      // Validate each distribution
      for (const d of distributions) {
        if (d.position < 1) {
          return apiError(ApiErrorCodes.VALUE_OUT_OF_RANGE, 'Position must be at least 1', undefined, 400)
        }
        if (d.percentage <= 0 || d.percentage > 100) {
          return apiError(ApiErrorCodes.VALUE_OUT_OF_RANGE, 'Percentage must be between 0 and 100', undefined, 400)
        }
      }
      finalDistributions = distributions
    } else {
      return apiError(ApiErrorCodes.VALIDATION_ERROR, 'No valid distribution data provided', undefined, 400)
    }

    // Create distribution
    const result = await createPrizeDistribution(id, finalDistributions)

    return apiResponse({
      success: true,
      message: 'Prize distribution created successfully',
      distribution: result,
      tournament: {
        id: tournament.id,
        prizePool: tournament.prizePool,
      },
    })
  } catch (error) {
    console.error('Error creating prize distribution:', error)
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to create prize distribution',
      undefined,
      500
    )
  }
}

/**
 * DELETE /api/tournaments/[id]/prizes
 * Delete prize distribution for a tournament
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Get tournament
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    })

    if (!tournament) {
      return apiError(ApiErrorCodes.NOT_FOUND, 'Tournament not found', undefined, 404)
    }

    // Check if tournament can have prize distribution deleted
    if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') {
      return apiError(
        ApiErrorCodes.CONFLICT,
        'Cannot delete prize distribution for completed or cancelled tournaments',
        undefined,
        400
      )
    }

    // Check if there are existing payouts
    const existingPayouts = await db.prizePayout.count({
      where: { tournamentId: id },
    })

    if (existingPayouts > 0) {
      return apiError(ApiErrorCodes.CONFLICT, 'Cannot delete prize distribution when payouts exist', undefined, 400)
    }

    // Delete distribution
    const { deletePrizeDistribution } = await import('@/lib/prize-pool')
    await deletePrizeDistribution(id)

    return apiResponse({
      success: true,
      message: 'Prize distribution deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting prize distribution:', error)
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to delete prize distribution',
      undefined,
      500
    )
  }
}
