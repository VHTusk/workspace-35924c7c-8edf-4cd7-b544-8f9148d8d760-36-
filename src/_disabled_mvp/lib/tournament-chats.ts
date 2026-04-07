import { db } from '@/lib/db';
import { ChatType } from '@prisma/client';

interface CreateTournamentChatsResult {
  generalChatId: string;
  announcementsChatId: string;
}

/**
 * Create group chats for a tournament when it opens for registration
 * Creates both General and Announcements channels
 */
export async function createTournamentGroupChats(
  tournamentId: string,
  directorId: string
): Promise<CreateTournamentChatsResult> {
  // Get tournament details
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      registrations: {
        where: { status: 'CONFIRMED' },
        include: {
          user: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  // Check if chats already exist
  const existingChats = await db.groupChat.findMany({
    where: { tournamentId },
  });

  if (existingChats.length > 0) {
    return {
      generalChatId: existingChats.find((c) => c.type === 'TOURNAMENT_GENERAL')?.id || '',
      announcementsChatId: existingChats.find((c) => c.type === 'TOURNAMENT_ANNOUNCEMENTS')?.id || '',
    };
  }

  // Create General chat
  const generalChat = await db.groupChat.create({
    data: {
      name: `${tournament.name} - General`,
      sport: tournament.sport,
      type: 'TOURNAMENT_GENERAL' as ChatType,
      tournamentId,
      createdById: directorId,
      members: {
        create: [
          // Director is admin
          { userId: directorId, role: 'ADMIN' },
          // Add all registered players
          ...(tournament.registrations || [])
            .filter((r) => r.user.id !== directorId)
            .map((r) => ({
              userId: r.user.id,
              role: 'MEMBER' as const,
            })),
        ],
      },
    },
  });

  // Create Announcements chat (director-only posting)
  const announcementsChat = await db.groupChat.create({
    data: {
      name: `${tournament.name} - Announcements`,
      sport: tournament.sport,
      type: 'TOURNAMENT_ANNOUNCEMENTS' as ChatType,
      tournamentId,
      createdById: directorId,
      members: {
        create: [
          // Director is admin
          { userId: directorId, role: 'ADMIN' },
          // Add all registered players as members (read-only)
          ...(tournament.registrations || [])
            .filter((r) => r.user.id !== directorId)
            .map((r) => ({
              userId: r.user.id,
              role: 'MEMBER' as const,
            })),
        ],
      },
    },
  });

  return {
    generalChatId: generalChat.id,
    announcementsChatId: announcementsChat.id,
  };
}

/**
 * Add a player to tournament group chats when they register
 */
export async function addPlayerToTournamentChats(
  tournamentId: string,
  userId: string
): Promise<void> {
  const chats = await db.groupChat.findMany({
    where: {
      tournamentId,
      type: { in: ['TOURNAMENT_GENERAL', 'TOURNAMENT_ANNOUNCEMENTS'] },
    },
  });

  for (const chat of chats) {
    // Check if already a member
    const existingMember = await db.groupChatMember.findUnique({
      where: {
        chatId_userId: {
          chatId: chat.id,
          userId,
        },
      },
    });

    if (!existingMember) {
      await db.groupChatMember.create({
        data: {
          chatId: chat.id,
          userId,
          role: 'MEMBER',
        },
      });

      // Create system message
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      if (user) {
        await db.groupChatMessage.create({
          data: {
            chatId: chat.id,
            senderId: userId,
            content: `${user.firstName} ${user.lastName} joined the tournament`,
            type: 'SYSTEM',
          },
        });
      }
    }
  }
}

/**
 * Remove a player from tournament group chats when they withdraw
 */
export async function removePlayerFromTournamentChats(
  tournamentId: string,
  userId: string
): Promise<void> {
  const chats = await db.groupChat.findMany({
    where: {
      tournamentId,
      type: { in: ['TOURNAMENT_GENERAL', 'TOURNAMENT_ANNOUNCEMENTS'] },
    },
  });

  for (const chat of chats) {
    await db.groupChatMember.deleteMany({
      where: {
        chatId: chat.id,
        userId,
      },
    });

    // Create system message
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (user) {
      await db.groupChatMessage.create({
        data: {
          chatId: chat.id,
          senderId: userId,
          content: `${user.firstName} ${user.lastName} left the tournament`,
          type: 'SYSTEM',
        },
      });
    }
  }
}

/**
 * Set tournament chats to read-only when tournament completes
 */
export async function setTournamentChatsReadOnly(
  tournamentId: string
): Promise<void> {
  await db.groupChat.updateMany({
    where: {
      tournamentId,
      type: 'TOURNAMENT_GENERAL',
    },
    data: {
      isReadOnly: true,
    },
  });
}

/**
 * Get group chats for a tournament
 */
export async function getTournamentChats(tournamentId: string, userId: string) {
  const chats = await db.groupChat.findMany({
    where: {
      tournamentId,
      isActive: true,
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
      _count: {
        select: { members: true },
      },
    },
    orderBy: [
      { type: 'asc' }, // ANNOUNCEMENTS first, then GENERAL
    ],
  });

  return chats.map((chat) => ({
    id: chat.id,
    name: chat.name,
    type: chat.type,
    isActive: chat.isActive,
    isReadOnly: chat.isReadOnly,
    membersCount: chat._count.members,
    userRole: chat.members[0]?.role || null,
  }));
}
