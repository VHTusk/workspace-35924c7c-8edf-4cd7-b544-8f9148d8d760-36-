import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { MessageType } from '@prisma/client';
import { filterProfanity } from '@/lib/content-moderation';

// GET /api/group-chats/[id]/messages - Get chat messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    // Check if user is a member of this chat
    const membership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this chat' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before'); // Message ID to paginate before

    // Build where clause for pagination
    const where: {
      chatId: string;
      deletedAt: null;
      createdAt?: { lt: Date };
    } = {
      chatId: id,
      deletedAt: null,
    };

    if (before) {
      const beforeMessage = await db.groupChatMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await db.groupChatMessage.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Update last read timestamp
    if (messages.length > 0) {
      await db.groupChatMember.update({
        where: {
          chatId_userId: {
            chatId: id,
            userId: sessionUser.id,
          },
        },
        data: { lastReadAt: new Date() },
      });
    }

    // Return messages in chronological order (oldest first)
    return NextResponse.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/group-chats/[id]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await getAuthenticatedUser(request);

    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user: sessionUser } = authResult;

    // Check chat and membership
    const chat = await db.groupChat.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: sessionUser.id },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    if (chat.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this chat' }, { status: 403 });
    }

    if (!chat.isActive) {
      return NextResponse.json({ error: 'This chat is no longer active' }, { status: 400 });
    }

    if (chat.isReadOnly) {
      return NextResponse.json({ error: 'This chat is read-only' }, { status: 400 });
    }

    // For announcements chat, only admins can send messages
    if (chat.type === 'TOURNAMENT_ANNOUNCEMENTS') {
      const membership = chat.members[0];
      if (membership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can post announcements' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { content, type = 'TEXT', imageUrl } = body;

    if (!content && !imageUrl) {
      return NextResponse.json({ error: 'Message content or image is required' }, { status: 400 });
    }

    // Filter profanity from message content
    const { filtered: filteredContent } = filterProfanity(content || '', sessionUser.sport);

    // Create message
    const message = await db.groupChatMessage.create({
      data: {
        chatId: id,
        senderId: sessionUser.id,
        content: filteredContent,
        type: type as MessageType,
        imageUrl: imageUrl || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update chat's updatedAt timestamp
    await db.groupChat.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
