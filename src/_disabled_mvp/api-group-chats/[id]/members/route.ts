import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { ChatRole } from '@prisma/client';

// GET /api/group-chats/[id]/members - Get chat members
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

    const members = await db.groupChatMember.findMany({
      where: { chatId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            visiblePoints: true,
            tier: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // ADMIN first
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/group-chats/[id]/members - Add members to chat (admin only)
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

    // Check if user is admin of the chat
    const adminMembership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!adminMembership || adminMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only chat admins can add members' }, { status: 403 });
    }

    const body = await request.json();
    const { userIds, role = 'MEMBER' } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs are required' }, { status: 400 });
    }

    // Check if chat exists and is active
    const chat = await db.groupChat.findUnique({
      where: { id },
    });

    if (!chat || !chat.isActive) {
      return NextResponse.json({ error: 'Chat not found or inactive' }, { status: 404 });
    }

    // Add members (skip if already a member)
    const addedMembers = [];
    for (const userId of userIds) {
      try {
        const member = await db.groupChatMember.create({
          data: {
            chatId: id,
            userId,
            role: role as ChatRole,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
        addedMembers.push(member);
      } catch {
        // Skip if already a member (unique constraint violation)
        console.log(`User ${userId} is already a member of chat ${id}`);
      }
    }

    // Create system message about new members
    if (addedMembers.length > 0) {
      const names = addedMembers.map((m) => `${m.user.firstName} ${m.user.lastName}`).join(', ');
      await db.groupChatMessage.create({
        data: {
          chatId: id,
          senderId: sessionUser.id,
          content: `${sessionUser.firstName} ${sessionUser.lastName} added ${names} to the chat`,
          type: 'SYSTEM',
        },
      });
    }

    return NextResponse.json({ addedMembers, count: addedMembers.length });
  } catch (error) {
    console.error('Add members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/group-chats/[id]/members - Update member role (admin only)
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
    const adminMembership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!adminMembership || adminMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only chat admins can update member roles' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, isMuted } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateData: { role?: ChatRole; isMuted?: boolean } = {};
    if (role) updateData.role = role as ChatRole;
    if (isMuted !== undefined) updateData.isMuted = isMuted;

    const member = await db.groupChatMember.update({
      where: {
        chatId_userId: {
          chatId: id,
          userId,
        },
      },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/group-chats/[id]/members - Remove member from chat (admin only)
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
    const adminMembership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!adminMembership || adminMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only chat admins can remove members' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Don't allow removing the last admin
    const memberToRemove = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId,
        },
      },
    });

    if (memberToRemove?.role === 'ADMIN') {
      const adminCount = await db.groupChatMember.count({
        where: { chatId: id, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
      }
    }

    await db.groupChatMember.delete({
      where: {
        chatId_userId: {
          chatId: id,
          userId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
