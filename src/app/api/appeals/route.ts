import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { AppealType } from '@prisma/client';

// POST /api/appeals - Submit an appeal
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;
    const body = await request.json();
    const { sport, appealType, relatedId, reason, evidence } = body;

    // Validate required fields
    if (!appealType || !reason || reason.trim().length < 50) {
      return NextResponse.json(
        { error: 'Please provide all required fields with at least 50 characters for reason' },
        { status: 400 }
      );
    }

    if (!Object.values(AppealType).includes(appealType as AppealType)) {
      return NextResponse.json(
        { error: 'Invalid appeal type' },
        { status: 400 }
      );
    }

    const appeal = await db.appeal.create({
      data: {
        userId: user.id,
        type: appealType as AppealType,
        relatedId: relatedId || null,
        reason,
        evidence: evidence || null,
      },
    });

    return NextResponse.json({
      success: true,
      appeal: {
        id: appeal.id,
        type: appeal.type,
        status: appeal.status,
        submittedAt: appeal.submittedAt,
      },
      message: 'Appeal submitted successfully. We will review it within 3-5 business days.',
    });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    return NextResponse.json(
      { error: 'Failed to submit appeal' },
      { status: 500 }
    );
  }
}

// GET /api/appeals - Get user's appeals
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { user } = auth;

    const appeals = await db.appeal.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      appeals: appeals.map((a) => ({
        id: a.id,
        type: a.type,
        subject: `Appeal: ${a.type.replace(/_/g, ' ')}`,
        status: a.status,
        submittedAt: a.submittedAt,
        updatedAt: a.reviewedAt ?? a.submittedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching appeals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appeals' },
      { status: 500 }
    );
  }
}
