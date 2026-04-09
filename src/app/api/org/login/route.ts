/**
 * Org-Level Login API
 * 
 * This API allows organization login without requiring sport in the URL.
 * It finds the organization by email/phone and uses the first matching org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createOrgSession } from '@/lib/auth';
import { setCsrfCookie } from '@/lib/csrf';
import { setSessionCookie } from '@/lib/session-helpers';
import { withRateLimit } from '@/lib/rate-limit';

async function orgLoginHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, phone, password } = body;

    // Email or phone is required
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    // Password is required
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Find organization by email or phone
    let org;
    if (email) {
      org = await db.organization.findFirst({
        where: { email },
        include: {
          subscription: true,
          orgAdmins: {
            where: { isActive: true },
            include: { user: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    } else if (phone) {
      org = await db.organization.findFirst({
        where: { phone },
        include: {
          subscription: true,
          orgAdmins: {
            where: { isActive: true },
            include: { user: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 401 }
      );
    }

    // Verify password
    if (!org.password) {
      return NextResponse.json(
        { error: 'Invalid account configuration' },
        { status: 500 }
      );
    }

    const isValid = await verifyPassword(password, org.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    // Create session
    const session = await createOrgSession(org.id, org.sport);

    // Get roster count
    const rosterCount = await db.orgRosterPlayer.count({
      where: { orgId: org.id, isActive: true },
    });

    // Get all sports this org has subscriptions for
    const allOrgs = await db.organization.findMany({
      where: {
        OR: [
          { email: org.email || undefined },
          { phone: org.phone || undefined },
        ],
      },
      select: {
        id: true,
        sport: true,
        type: true,
      },
    });

    // Set cookie and return response
    const response = NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        type: org.type,
        email: org.email,
        phone: org.phone,
        city: org.city,
        state: org.state,
        sport: org.sport,
        planTier: org.planTier,
        subscription: org.subscription ? {
          status: org.subscription.status,
          endDate: org.subscription.endDate,
        } : null,
        memberCount: rosterCount,
        totalMembers: rosterCount,
        activeSports: allOrgs.length,
        relatedOrgs: allOrgs.map(o => ({
          id: o.id,
          sport: o.sport,
          type: o.type,
        })),
      },
    });

    setSessionCookie(response, session.token);

    // Set CSRF token cookie for subsequent requests
    setCsrfCookie(response);

    return response;
  } catch (error) {
    console.error('Org login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(orgLoginHandler, 'LOGIN');
