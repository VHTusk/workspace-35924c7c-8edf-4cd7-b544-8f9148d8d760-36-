/**
 * V1 Conversation Messages API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/conversations/[id]/messages
 * 
 * Requires: Bearer token or session cookie
 * 
 * Query Parameters:
 * - cursor (string, optional) - Last message ID from previous page
 * - limit (number, optional) - Results per page (default: 50, max: 100)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": [...],
 *   "meta": {
 *     "nextCursor": "...",
 *     "hasMore": false
 *   }
 * }
 * 
 * POST /api/v1/conversations/[id]/messages
 * 
 * Request body:
 * {
 *   "content": "Hello!"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    const { user } = auth;
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Check if user is participant
    const participant = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      return apiError(
        ApiErrorCodes.FORBIDDEN,
        'Access denied to this conversation',
        undefined,
        403
      );
    }

    // Get messages with cursor pagination
    const messages = await db.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    // Mark as read
    await db.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    // Reverse for chronological order
    const reversedItems = [...items].reverse();

    const response = NextResponse.json({
      success: true,
      data: reversedItems.map(m => ({
        id: m.id,
        content: m.content,
        sender: {
          id: m.sender.id,
          name: `${m.sender.firstName} ${m.sender.lastName}`,
          photoUrl: m.sender.photoUrl,
        },
        createdAt: m.createdAt.toISOString(),
        isOwn: m.senderId === user.id,
      })),
      meta: {
        nextCursor,
        hasMore,
        limit,
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;

  } catch (error) {
    console.error('[V1 Messages] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch messages',
      undefined,
      500
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedFromRequest(request);

    if (!auth) {
      return apiError(
        ApiErrorCodes.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    }

    const { user } = auth;
    const { id: conversationId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return apiError(
        ApiErrorCodes.VALIDATION_ERROR,
        'Message content required',
        { required: ['content'] }
      );
    }

    // Check if user is participant
    const participant = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      return apiError(
        ApiErrorCodes.FORBIDDEN,
        'Access denied to this conversation',
        undefined,
        403
      );
    }

    // Create message
    const message = await db.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
    });

    // Update conversation updatedAt
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: message.id,
        content: message.content,
        sender: {
          id: message.sender.id,
          name: `${message.sender.firstName} ${message.sender.lastName}`,
          photoUrl: message.sender.photoUrl,
        },
        createdAt: message.createdAt.toISOString(),
        isOwn: true,
      },
      meta: {
        version: 'v1',
        timestamp: new Date().toISOString(),
      },
    });

    response.headers.set('X-API-Version', 'v1');
    response.headers.set('X-API-Immutable', 'true');
    return response;

  } catch (error) {
    console.error('[V1 Messages Create] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to send message',
      undefined,
      500
    );
  }
}
