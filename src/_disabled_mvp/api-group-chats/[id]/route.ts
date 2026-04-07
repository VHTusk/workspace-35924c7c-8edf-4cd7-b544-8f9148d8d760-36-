import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/group-chats/[id] - Get chat details
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

    const groupChat = await db.groupChat.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                visiblePoints: true,
                tier: true,
              },
            },
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            status: true,
            type: true,
          },
        },
      },
    });

    if (!groupChat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Check if user is a member
    const membership = groupChat.members.find((m) => m.userId === sessionUser.id);
    const isMember = !!membership;
    const userRole = membership?.role || null;

    // Get unread count
    const unreadCount = await db.groupChatMessage.count({
      where: {
        chatId: id,
        createdAt: { gt: membership?.lastReadAt || new Date(0) },
        senderId: { not: sessionUser.id },
        deletedAt: null,
      },
    });

    return NextResponse.json({
      groupChat: {
        ...groupChat,
        unreadCount,
        isMember,
        userRole,
      },
    });
  } catch (error) {
    console.error('Get group chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/group-chats/[id] - Update chat settings (admin only)
export async function PUT(
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

    // Check if user is admin of the chat
    const membership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only chat admins can update settings' }, { status: 403 });
    }

    const body = await request.json();
    const { name, isActive, isReadOnly } = body;

    const updateData: {
      name?: string;
      isActive?: boolean;
      isReadOnly?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isReadOnly !== undefined) updateData.isReadOnly = isReadOnly;

    const groupChat = await db.groupChat.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ groupChat });
  } catch (error) {
    console.error('Update group chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/group-chats/[id] - Delete/deactivate chat (admin only)
export async function DELETE(
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

    // Check if user is admin of the chat
    const membership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only chat admins can delete chats' }, { status: 403 });
    }

    // Soft delete by setting isActive to false
    const groupChat = await db.groupChat.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ groupChat });
  } catch (error) {
    console.error('Delete group chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
