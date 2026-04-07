import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';

// GET /api/conversations - Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = session.user;

    const conversations = await db.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: sessionUser.id,
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
    });

    // Get unread counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === sessionUser.id);
        const unreadCount = await db.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: participant?.lastReadAt || new Date(0) },
            senderId: { not: sessionUser.id },
            deletedAt: null,
          },
        });

        return {
          ...conv,
          unreadCount,
        };
      })
    );

    return NextResponse.json({ conversations: conversationsWithUnread });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = session.user;

    const body = await request.json();
    const { participantIds, type = 'direct', name, initialMessage } = body;

    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json({ error: 'Participants required' }, { status: 400 });
    }

    // For direct messages, check if conversation already exists
    if (type === 'direct' && participantIds.length === 1) {
      const existingConversation = await db.conversation.findFirst({
        where: {
          sport: sessionUser.sport,
          type: 'direct',
          AND: [
            { participants: { some: { userId: sessionUser.id } } },
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
              senderId: sessionUser.id,
              content: initialMessage,
            },
          });
        }
        return NextResponse.json({ conversation: existingConversation });
      }
    }

    // Create new conversation
    const conversation = await db.conversation.create({
      data: {
        sport: sessionUser.sport,
        type,
        name: type === 'group' ? name : null,
        createdById: sessionUser.id,
        participants: {
          create: [
            { userId: sessionUser.id },
            ...participantIds.map((id: string) => ({ userId: id })),
          ],
        },
        ...(initialMessage && {
          messages: {
            create: {
              senderId: sessionUser.id,
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
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
