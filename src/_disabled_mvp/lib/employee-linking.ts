/**
 * Employee-to-Player Linking Service
 * Handles invite generation, email sending, and account linking
 */

import { db } from '@/lib/db'
import { EmployeeLinkStatus, SportType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { EmailService } from './email-service'

// Constants
const INVITE_TOKEN_EXPIRY_DAYS = 7

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a secure invite token
 * Uses UUID v4 for cryptographic randomness
 */
export function generateInviteToken(): string {
  return randomUUID()
}

/**
 * Create the invite link URL for employees
 */
export function createInviteLink(token: string, sport: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/employee/link/${token}?sport=${sport.toLowerCase()}`
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send employee invite email
 * Logs to console in development mode
 */
export async function sendEmployeeInvite(params: {
  employeeId: string
  orgName: string
  sport: SportType
}): Promise<{ success: boolean; error?: string }> {
  const { employeeId, orgName, sport } = params

  try {
    // Get employee details
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        organization: true,
      },
    })

    if (!employee) {
      return { success: false, error: 'Employee not found' }
    }

    // Check if already linked
    if (employee.linkStatus === EmployeeLinkStatus.LINKED) {
      return { success: false, error: 'Employee is already linked to a player account' }
    }

    // Generate new token
    const token = generateInviteToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_TOKEN_EXPIRY_DAYS)

    // Update employee with new token
    await db.employee.update({
      where: { id: employeeId },
      data: {
        inviteToken: token,
        inviteTokenExpires: expiresAt,
        inviteSentAt: new Date(),
        linkStatus: EmployeeLinkStatus.INVITED,
      },
    })

    // Create invite link
    const inviteLink = createInviteLink(token, sport)

    // Send email
    const emailService = new EmailService()
    const emailResult = await emailService.sendEmployeeInviteEmail(
      { email: employee.email, name: `${employee.firstName} ${employee.lastName}` },
      {
        organizationName: orgName,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        magicLink: inviteLink,
        expiresInDays: INVITE_TOKEN_EXPIRY_DAYS,
      }
    )

    // In development mode, log the invite link
    if (process.env.NODE_ENV === 'development') {
      console.log('='.repeat(60))
      console.log('📧 EMPLOYEE INVITE EMAIL (Development Mode)')
      console.log('='.repeat(60))
      console.log(`To: ${employee.email}`)
      console.log(`Employee: ${employee.firstName} ${employee.lastName}`)
      console.log(`Organization: ${orgName}`)
      console.log(`Sport: ${sport}`)
      console.log(`Invite Link: ${inviteLink}`)
      console.log(`Token: ${token}`)
      console.log(`Expires: ${expiresAt.toISOString()}`)
      console.log('='.repeat(60))
    }

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error)
      // Still return success since token is saved, but note the email failure
      return { 
        success: true, 
        error: 'Invite created but email delivery failed. Check logs for details.' 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending employee invite:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

// ============================================
// INVITE ACCEPTANCE
// ============================================

/**
 * Validate an invite token
 * Returns employee info if valid, error if invalid/expired
 */
export async function validateInviteToken(token: string): Promise<{
  valid: boolean
  employee?: {
    id: string
    email: string
    firstName: string
    lastName: string
    department?: string | null
    designation?: string | null
  }
  organization?: {
    id: string
    name: string
    type: string
  }
  sport?: SportType
  error?: string
}> {
  try {
    const employee = await db.employee.findFirst({
      where: {
        inviteToken: token,
        linkStatus: EmployeeLinkStatus.INVITED,
      },
      include: {
        organization: true,
      },
    })

    if (!employee) {
      return { valid: false, error: 'Invalid or expired invite token' }
    }

    // Check if token has expired
    if (employee.inviteTokenExpires && employee.inviteTokenExpires < new Date()) {
      // Update status to expired
      await db.employee.update({
        where: { id: employee.id },
        data: { linkStatus: EmployeeLinkStatus.EXPIRED },
      })
      return { valid: false, error: 'This invite has expired. Please request a new one.' }
    }

    return {
      valid: true,
      employee: {
        id: employee.id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        designation: employee.designation,
      },
      organization: {
        id: employee.organization.id,
        name: employee.organization.name,
        type: employee.organization.type,
      },
      sport: employee.sport,
    }
  } catch (error) {
    console.error('Error validating invite token:', error)
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    }
  }
}

/**
 * Process invite acceptance
 * Links employee to player account
 */
export async function processInviteAcceptance(params: {
  token: string
  userId: string
  sport: SportType
}): Promise<{ success: boolean; employeeId?: string; error?: string }> {
  const { token, userId, sport } = params

  try {
    // Validate the token first
    const validation = await validateInviteToken(token)
    if (!validation.valid || !validation.employee) {
      return { success: false, error: validation.error }
    }

    // Check sport matches
    if (validation.sport !== sport) {
      return { success: false, error: 'Sport mismatch. Please use the correct invite link.' }
    }

    // Get the user
    const user = await db.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return { success: false, error: 'User account not found' }
    }

    // Verify user's sport matches
    if (user.sport !== sport) {
      return { success: false, error: 'Your account is not registered for this sport' }
    }

    // Check if user is already linked to another employee in this org
    const existingEmployee = await db.employee.findFirst({
      where: {
        orgId: validation.organization!.id,
        userId: userId,
        sport: sport,
      },
    })

    if (existingEmployee && existingEmployee.id !== validation.employee.id) {
      return { success: false, error: 'You are already linked to another employee record in this organization' }
    }

    // Check if the employee's email matches the user's email (verification)
    const employee = await db.employee.findUnique({
      where: { id: validation.employee.id },
    })

    if (!employee) {
      return { success: false, error: 'Employee record not found' }
    }

    // Email verification (optional - can be made configurable)
    if (employee.email.toLowerCase() !== user.email?.toLowerCase()) {
      console.warn(`Email mismatch: Employee ${employee.email} vs User ${user.email}`)
      // Still allow linking but log the discrepancy
    }

    // Perform the linking in a transaction
    await db.$transaction(async (tx) => {
      // Update employee record
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          userId: userId,
          linkStatus: EmployeeLinkStatus.LINKED,
          linkedAt: new Date(),
          linkedById: userId,
          inviteToken: null,
          inviteTokenExpires: null,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: userId,
        },
      })

      // Update user's organization affiliation
      await tx.user.update({
        where: { id: userId },
        data: {
          affiliatedOrgId: employee.orgId,
          playerOrgType: 'EMPLOYEE',
        },
      })

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          sport: sport,
          action: 'ADMIN_OVERRIDE', // Using existing enum value for linking
          actorId: userId,
          actorRole: 'PLAYER',
          targetType: 'Employee',
          targetId: employee.id,
          metadata: JSON.stringify({
            action: 'employee_linked',
            orgId: employee.orgId,
            email: employee.email,
          }),
        },
      })
    })

    return { success: true, employeeId: employee.id }
  } catch (error) {
    console.error('Error processing invite acceptance:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process acceptance' 
    }
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Bulk send invites to multiple employees
 */
export async function bulkSendInvites(params: {
  orgId: string
  employeeIds: string[]
  sport: SportType
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { orgId, employeeIds, sport } = params
  const results = { sent: 0, failed: 0, errors: [] as string[] }

  // Get organization
  const org = await db.organization.findUnique({
    where: { id: orgId },
  })

  if (!org) {
    results.errors.push('Organization not found')
    return results
  }

  // Get employees
  const employees = await db.employee.findMany({
    where: {
      id: { in: employeeIds },
      orgId: orgId,
      sport: sport,
    },
  })

  if (employees.length === 0) {
    results.errors.push('No employees found')
    return results
  }

  // Process each employee
  for (const employee of employees) {
    try {
      // Skip if already linked
      if (employee.linkStatus === EmployeeLinkStatus.LINKED) {
        results.failed++
        results.errors.push(`${employee.email}: Already linked`)
        continue
      }

      const result = await sendEmployeeInvite({
        employeeId: employee.id,
        orgName: org.name,
        sport: sport,
      })

      if (result.success) {
        results.sent++
      } else {
        results.failed++
        results.errors.push(`${employee.email}: ${result.error}`)
      }
    } catch (error) {
      results.failed++
      results.errors.push(`${employee.email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

/**
 * Resend invite to an employee
 */
export async function resendEmployeeInvite(params: {
  employeeId: string
  orgId: string
  sport: SportType
}): Promise<{ success: boolean; error?: string }> {
  const { employeeId, orgId, sport } = params

  try {
    // Get employee
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        orgId: orgId,
        sport: sport,
      },
      include: { organization: true },
    })

    if (!employee) {
      return { success: false, error: 'Employee not found' }
    }

    // Check if already linked
    if (employee.linkStatus === EmployeeLinkStatus.LINKED) {
      return { success: false, error: 'Employee is already linked' }
    }

    // Generate new token
    const token = generateInviteToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_TOKEN_EXPIRY_DAYS)

    // Update employee with new token
    await db.employee.update({
      where: { id: employeeId },
      data: {
        inviteToken: token,
        inviteTokenExpires: expiresAt,
        inviteSentAt: new Date(),
        linkStatus: EmployeeLinkStatus.INVITED,
      },
    })

    // Create invite link
    const inviteLink = createInviteLink(token, sport)

    // Send email
    const emailService = new EmailService()
    const emailResult = await emailService.sendEmployeeInviteEmail(
      { email: employee.email, name: `${employee.firstName} ${employee.lastName}` },
      {
        organizationName: employee.organization.name,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        magicLink: inviteLink,
        expiresInDays: INVITE_TOKEN_EXPIRY_DAYS,
      }
    )

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('='.repeat(60))
      console.log('📧 RESEND EMPLOYEE INVITE (Development Mode)')
      console.log('='.repeat(60))
      console.log(`To: ${employee.email}`)
      console.log(`Invite Link: ${inviteLink}`)
      console.log(`Token: ${token}`)
      console.log('='.repeat(60))
    }

    if (!emailResult.success) {
      return { 
        success: true, 
        error: 'Invite resent but email delivery failed. Check logs for details.' 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error resending invite:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}
