/**
 * V1 Conversations API
 * 
 * IMMUTABLE - Do not change this endpoint's behavior or response structure.
 * For changes, create a v2 route.
 * 
 * GET /api/v1/conversations
 * 
 * Requires: Bearer token or session cookie
 * 
 * Query Parameters:
 * - cursor (string, optional) - Last conversation ID from previous page
 * - limit (number, optional) - Results per page (default: 20, max: 50)
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
 * POST /api/v1/conversations
 * 
 * Request body:
 * {
 *   "participantIds": ["user_id_1", "user_id_2"],
 *   "type": "direct" | "group",
 *   "name": "Group name (for groups)",
 *   "initialMessage": "Hello!"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError, ApiErrorCodes } from '@/lib/api-response';
import { getAuthenticatedFromRequest } from '@/lib/auth-canonical';
import { getCDNUrl } from '@/lib/cdn-url';

export async function GET(request: NextRequest) {
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

    const { user, session } = auth;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Get conversations with cursor pagination
    const conversations = await db.conversation.findMany({
      where: {
        sport: session.sport,
        participants: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
    });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === user.id);
        const unreadCount = await db.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: participant?.lastReadAt || new Date(0) },
            senderId: { not: user.id },
            deletedAt: null,
          },
        });

        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          participants: conv.participants.map(p => ({
            id: p.user.id,
            name: `${p.user.firstName} ${p.user.lastName}`,
            photoUrl: getCDNUrl(p.user.photoUrl),
          })),
          lastMessage: conv.messages[0] ? {
            id: conv.messages[0].id,
            content: conv.messages[0].content,
            sender: {
              id: conv.messages[0].sender.id,
              name: `${conv.messages[0].sender.firstName} ${conv.messages[0].sender.lastName}`,
            },
            createdAt: conv.messages[0].createdAt.toISOString(),
          } : null,
          unreadCount,
          updatedAt: conv.updatedAt.toISOString(),
        };
      })
    );

    const hasMore = conversationsWithUnread.length > limit;
    const items = hasMore ? conversationsWithUnread.slice(0, limit) : conversationsWithUnread;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    const response = NextResponse.json({
      success: true,
      data: items,
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
    console.error('[V1 Conversations] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to fetch conversations',
      undefined,
      500
    );
  }
}

export async function POST(request: NextRequest) {
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

    const { user, session } = auth;
    const body = await request.json();
    const { participantIds, type = 'direct', name, initialMessage } = body;

    if (!participantIds || participantIds.length === 0) {
      return apiError(
        ApiErrorCodes.MISSING_REQUIRED_FIELD,
        'Participants required',
        { required: ['participantIds'] }
      );
    }

    // For direct messages, check if conversation already exists
    if (type === 'direct' && participantIds.length === 1) {
      const existingConversation = await db.conversation.findFirst({
        where: {
          sport: session.sport,
          type: 'direct',
          AND: [
            { participants: { some: { userId: user.id } } },
            { participants: { some: { userId: participantIds[0] } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      if (existingConversation) {
        // Send initial message if provided
        if (initialMessage) {
          await db.message.create({
            data: {
              conversationId: existingConversation.id,
              senderId: user.id,
              content: initialMessage,
            },
          });
        }

        const response = NextResponse.json({
          success: true,
          data: {
            id: existingConversation.id,
            type: existingConversation.type,
            participants: existingConversation.participants.map(p => ({
              id: p.user.id,
              name: `${p.user.firstName} ${p.user.lastName}`,
              photoUrl: getCDNUrl(p.user.photoUrl),
            })),
            isNew: false,
          },
          meta: {
            version: 'v1',
            timestamp: new Date().toISOString(),
          },
        });

        response.headers.set('X-API-Version', 'v1');
        response.headers.set('X-API-Immutable', 'true');
        return response;
      }
    }

    // Create new conversation
    const conversation = await db.conversation.create({
      data: {
        sport: session.sport,
        type,
        name: type === 'group' ? name : null,
        createdById: user.id,
        participants: {
          create: [
            { userId: user.id },
            ...participantIds.map((id: string) => ({ userId: id })),
          ],
        },
        ...(initialMessage && {
          messages: {
            create: {
              senderId: user.id,
              content: initialMessage,
            },
          },
        }),
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        participants: conversation.participants.map(p => ({
          id: p.user.id,
          name: `${p.user.firstName} ${p.user.lastName}`,
          photoUrl: getCDNUrl(p.user.photoUrl),
        })),
        isNew: true,
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
    console.error('[V1 Conversations Create] Error:', error);
    return apiError(
      ApiErrorCodes.INTERNAL_ERROR,
      'Failed to create conversation',
      undefined,
      500
    );
  }
}
