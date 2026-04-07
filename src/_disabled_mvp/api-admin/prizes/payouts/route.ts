import { NextRequest, NextResponse } from 'next/server'
import {
  getPayouts,
  createPayouts,
  bulkUpdatePayoutStatus,
  exportPayoutsCsv,
} from '@/lib/prize-pool'
import { PayoutStatus } from '@prisma/client'
import { apiResponse, apiError } from '@/lib/api-response'
import { safeParseInt } from '@/lib/validation'

/**
 * GET /api/admin/prizes/payouts
 * List all payouts with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parse filters
    const status = searchParams.get('status') as PayoutStatus | null
    const tournamentId = searchParams.get('tournamentId')
    const sport = searchParams.get('sport')
    const limit = safeParseInt(searchParams.get('limit'), 50, 1, 100)
    const offset = safeParseInt(searchParams.get('offset'), 0, 0, 100000)
    const exportCsv = searchParams.get('export') === 'csv'

    // Validate status
    if (status && !Object.keys(PayoutStatus).includes(status)) {
      return apiError('Invalid status value', 400)
    }

    // Export CSV for specific tournament
    if (exportCsv && tournamentId) {
      const csv = await exportPayoutsCsv(tournamentId)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payouts-${tournamentId}.csv"`,
        },
      })
    }

    // Get payouts
    const result = await getPayouts({
      status: status || undefined,
      tournamentId: tournamentId || undefined,
      sport: sport || undefined,
      limit,
      offset,
    })

    return apiResponse({
      success: true,
      data: result.payouts,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
      summary: result.summary,
    })
  } catch (error) {
    console.error('Error fetching payouts:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch payouts',
      500
    )
  }
}

/**
 * POST /api/admin/prizes/payouts
 * Create payouts for a tournament (after completion)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tournamentId, results } = body

    if (!tournamentId) {
      return apiError('Tournament ID is required', 400)
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      return apiError('Results array is required', 400)
    }

    // Validate results structure
    for (const result of results) {
      if (typeof result.position !== 'number' || result.position < 1) {
        return apiError('Each result must have a valid position', 400)
      }
      if (!result.userId && !result.teamId) {
        return apiError('Each result must have either userId or teamId', 400)
      }
    }

    // Create payouts
    const payoutResult = await createPayouts(tournamentId, results)

    return apiResponse({
      success: payoutResult.success,
      message: payoutResult.success
        ? 'Payouts created successfully'
        : 'Payouts created with some errors',
      payouts: payoutResult.payouts,
      errors: payoutResult.errors,
    })
  } catch (error) {
    console.error('Error creating payouts:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to create payouts',
      500
    )
  }
}

/**
 * PUT /api/admin/prizes/payouts
 * Bulk update payout status
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { payoutIds, status, payoutMethod, transactionRef } = body

    if (!payoutIds || !Array.isArray(payoutIds) || payoutIds.length === 0) {
      return apiError('Payout IDs array is required', 400)
    }

    if (!status || !Object.keys(PayoutStatus).includes(status)) {
      return apiError('Valid status is required', 400)
    }

    // Bulk update
    const result = await bulkUpdatePayoutStatus(payoutIds, status as PayoutStatus, {
      payoutMethod,
      transactionRef,
    })

    return apiResponse({
      success: result.failed === 0,
      message: `Updated ${result.success} payouts`,
      ...result,
    })
  } catch (error) {
    console.error('Error updating payouts:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to update payouts',
      500
    )
  }
}
