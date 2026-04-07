import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth';

// POST /api/group-chats/[id]/leave - Leave a group chat
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

    // Check membership
    const membership = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this chat' }, { status: 400 });
    }

    // If user is admin, check if they're the last admin
    if (membership.role === 'ADMIN') {
      const adminCount = await db.groupChatMember.count({
        where: { chatId: id, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        return NextResponse.json({
          error: 'You are the last admin. Assign another admin before leaving or delete the chat instead.'
        }, { status: 400 });
      }
    }

    // Create system message about user leaving
    await db.groupChatMessage.create({
      data: {
        chatId: id,
        senderId: sessionUser.id,
        content: `${sessionUser.firstName} ${sessionUser.lastName} left the chat`,
        type: 'SYSTEM',
      },
    });

    // Remove member
    await db.groupChatMember.delete({
      where: {
        chatId_userId: {
          chatId: id,
          userId: sessionUser.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Leave chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
