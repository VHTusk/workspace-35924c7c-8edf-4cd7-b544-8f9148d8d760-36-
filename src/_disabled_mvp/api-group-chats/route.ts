import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { ChatType } from '@prisma/client';

// GET /api/group-chats - List user's group chats
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');
    const type = searchParams.get('type') as ChatType | null;

    // Build where clause
    const where: {
      sport: typeof sessionUser.sport;
      isActive: boolean;
      tournamentId?: string;
      type?: ChatType;
      members?: { some: { userId: string } };
    } = {
      sport: sessionUser.sport,
      isActive: true,
    };

    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    if (type) {
      where.type = type;
    }

    // If not filtering by tournament, only show chats user is a member of
    if (!tournamentId) {
      where.members = {
        some: { userId: sessionUser.id },
      };
    }

    const groupChats = await db.groupChat.findMany({
      where,
      include: {
        members: {
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
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get unread counts for each chat
    const chatsWithUnread = await Promise.all(
      groupChats.map(async (chat) => {
        const membership = chat.members.find((m) => m.userId === sessionUser.id);
        const unreadCount = await db.groupChatMessage.count({
          where: {
            chatId: chat.id,
            createdAt: { gt: membership?.lastReadAt || new Date(0) },
            senderId: { not: sessionUser.id },
            deletedAt: null,
          },
        });

        const isMember = !!membership;
        const userRole = membership?.role || null;

        return {
          ...chat,
          unreadCount,
          isMember,
          userRole,
        };
      })
    );

    return NextResponse.json({ groupChats: chatsWithUnread });
  } catch (error) {
    console.error('Get group chats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/group-chats - Create a new group chat (admin/system only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    const body = await request.json();
    const { name, type, tournamentId, memberIds, isAnnouncementsChat } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    // Check if chat already exists for this tournament/type
    if (tournamentId) {
      const existingChat = await db.groupChat.findUnique({
        where: {
          tournamentId_type: {
            tournamentId,
            type: type as ChatType,
          },
        },
      });

      if (existingChat) {
        return NextResponse.json({ groupChat: existingChat });
      }
    }

    // Create group chat with members
    const groupChat = await db.groupChat.create({
      data: {
        name,
        sport: sessionUser.sport,
        type: type as ChatType,
        tournamentId: tournamentId || null,
        createdById: sessionUser.id,
        members: {
          create: [
            // Creator is admin
            { userId: sessionUser.id, role: 'ADMIN' },
            // Add other members
            ...(memberIds || []).map((userId: string) => ({
              userId,
              role: 'MEMBER' as const,
            })),
          ],
        },
      },
      include: {
        members: {
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

    return NextResponse.json({ groupChat });
  } catch (error) {
    console.error('Create group chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
