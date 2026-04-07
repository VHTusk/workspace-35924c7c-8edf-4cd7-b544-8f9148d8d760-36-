import { NextRequest, NextResponse } from 'next/server'
import { updatePayoutStatus, getPayoutById } from '@/lib/prize-pool'
import { PayoutStatus } from '@prisma/client'
import { apiResponse, apiError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/prizes/payouts/[id]
 * Get payout details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const payout = await getPayoutById(id)

    if (!payout) {
      return apiError('Payout not found', 404)
    }

    return apiResponse({
      success: true,
      data: payout,
    })
  } catch (error) {
    console.error('Error fetching payout:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch payout',
      500
    )
  }
}

/**
 * PUT /api/admin/prizes/payouts/[id]
 * Update payout status
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate payout exists
    const existingPayout = await getPayoutById(id)
    if (!existingPayout) {
      return apiError('Payout not found', 404)
    }

    // Validate status transition
    const { status, payoutMethod, transactionRef, paidAt } = body

    if (!status || !Object.keys(PayoutStatus).includes(status)) {
      return apiError('Valid status is required', 400)
    }

    // Validate status transitions
    const validTransitions: Record<PayoutStatus, PayoutStatus[]> = {
      PENDING: ['PROCESSING', 'COMPLETED', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'FAILED', 'PENDING'],
      COMPLETED: [], // Cannot change from COMPLETED
      FAILED: ['PENDING', 'PROCESSING'],
      CANCELLED: ['PENDING'], // Can only reopen
    }

    const currentStatus = existingPayout.status as PayoutStatus
    const newStatus = status as PayoutStatus

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return apiError(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        400
      )
    }

    // Validate required fields for completion
    if (newStatus === 'COMPLETED') {
      if (!payoutMethod && !existingPayout.payoutMethod) {
        return apiError('Payout method is required for completion', 400)
      }
    }

    // Update payout
    const updatedPayout = await updatePayoutStatus(id, newStatus, {
      payoutMethod,
      transactionRef,
      paidAt: paidAt ? new Date(paidAt) : undefined,
    })

    return apiResponse({
      success: true,
      message: 'Payout status updated successfully',
      data: updatedPayout,
    })
  } catch (error) {
    console.error('Error updating payout:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to update payout',
      500
    )
  }
}

/**
 * DELETE /api/admin/prizes/payouts/[id]
 * Cancel a pending payout
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Validate payout exists
    const existingPayout = await getPayoutById(id)
    if (!existingPayout) {
      return apiError('Payout not found', 404)
    }

    // Can only cancel pending payouts
    if (existingPayout.status !== 'PENDING') {
      return apiError('Can only cancel pending payouts', 400)
    }

    // Cancel the payout
    const updatedPayout = await updatePayoutStatus(id, 'CANCELLED' as PayoutStatus)

    return apiResponse({
      success: true,
      message: 'Payout cancelled successfully',
      data: updatedPayout,
    })
  } catch (error) {
    console.error('Error cancelling payout:', error)
    return apiError(
      error instanceof Error ? error.message : 'Failed to cancel payout',
      500
    )
  }
}
