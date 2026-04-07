/**
 * Tournament Group Chat Utilities
 * 
 * Functions for managing auto-generated tournament group chats
 */

import { db } from '@/lib/db';
import { ChatType, ChatRole, MessageType, TournamentStatus } from '@prisma/client';

/**
 * Ensure tournament chats exist
 * Creates general and announcements chats if they don't exist
 */
export async function ensureTournamentChats(tournamentId: string): Promise<{
  generalChatId: string | null;
  announcementsChatId: string | null;
}> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  let generalChatId: string | null = null;
  let announcementsChatId: string | null = null;

  // Create or get general chat
  const existingGeneral = await db.groupChat.findUnique({
    where: {
      tournamentId_type: {
        tournamentId,
        type: 'TOURNAMENT_GENERAL' as ChatType,
      },
    },
  });

  if (existingGeneral) {
    generalChatId = existingGeneral.id;
  } else {
    // Find a director or admin to be the chat creator
    const director = await db.tournamentDirector.findFirst({
      where: { tournamentId },
      include: { user: true },
    });

    const creatorId = director?.userId || tournament.createdBy;

    const generalChat = await db.groupChat.create({
      data: {
        name: `${tournament.name} - General`,
        sport: tournament.sport,
        type: 'TOURNAMENT_GENERAL' as ChatType,
        tournamentId,
        createdById: creatorId,
        isReadOnly: false,
      },
    });
    generalChatId = generalChat.id;

    // Add creator as admin
    await db.groupChatMember.create({
      data: {
        chatId: generalChat.id,
        userId: creatorId,
        role: 'ADMIN' as ChatRole,
      },
    });

    // Add system welcome message
    await db.groupChatMessage.create({
      data: {
        chatId: generalChat.id,
        senderId: creatorId,
        content: `Welcome to ${tournament.name}! This is the general discussion chat for all participants.`,
        type: 'SYSTEM' as MessageType,
      },
    });
  }

  // Create or get announcements chat
  const existingAnnouncements = await db.groupChat.findUnique({
    where: {
      tournamentId_type: {
        tournamentId,
        type: 'TOURNAMENT_ANNOUNCEMENTS' as ChatType,
      },
    },
  });

  if (existingAnnouncements) {
    announcementsChatId = existingAnnouncements.id;
  } else {
    const director = await db.tournamentDirector.findFirst({
      where: { tournamentId },
      include: { user: true },
    });

    const creatorId = director?.userId || tournament.createdBy;

    const announcementsChat = await db.groupChat.create({
      data: {
        name: `${tournament.name} - Announcements`,
        sport: tournament.sport,
        type: 'TOURNAMENT_ANNOUNCEMENTS' as ChatType,
        tournamentId,
        createdById: creatorId,
        isReadOnly: true, // Only admins can post
      },
    });
    announcementsChatId = announcementsChat.id;

    // Add creator as admin
    await db.groupChatMember.create({
      data: {
        chatId: announcementsChat.id,
        userId: creatorId,
        role: 'ADMIN' as ChatRole,
      },
    });

    // Add system welcome message
    await db.groupChatMessage.create({
      data: {
        chatId: announcementsChat.id,
        senderId: creatorId,
        content: `Welcome to ${tournament.name}! This channel is for official tournament announcements only.`,
        type: 'SYSTEM' as MessageType,
      },
    });
  }

  return { generalChatId, announcementsChatId };
}

/**
 * Add a player to tournament chats when they register
 */
export async function addPlayerToTournamentChats(
  tournamentId: string,
  userId: string
): Promise<{ added: boolean; chatIds: string[] }> {
  const chatIds: string[] = [];
  let added = false;

  // Get or create tournament chats
  const { generalChatId, announcementsChatId } = await ensureTournamentChats(tournamentId);

  // Add to general chat
  if (generalChatId) {
    try {
      await db.groupChatMember.create({
        data: {
          chatId: generalChatId,
          userId,
          role: 'MEMBER' as ChatRole,
        },
      });
      chatIds.push(generalChatId);
      added = true;
    } catch {
      // Already a member
    }

    // Add join message
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (user) {
      await db.groupChatMessage.create({
        data: {
          chatId: generalChatId,
          senderId: userId,
          content: `${user.firstName} ${user.lastName} joined the chat`,
          type: 'SYSTEM' as MessageType,
        },
      });
    }
  }

  // Add to announcements chat (read-only)
  if (announcementsChatId) {
    try {
      await db.groupChatMember.create({
        data: {
          chatId: announcementsChatId,
          userId,
          role: 'MEMBER' as ChatRole,
        },
      });
      chatIds.push(announcementsChatId);
    } catch {
      // Already a member
    }
  }

  return { added, chatIds };
}

/**
 * Remove a player from tournament chats when they withdraw
 */
export async function removePlayerFromTournamentChats(
  tournamentId: string,
  userId: string
): Promise<{ removed: boolean }> {
  let removed = false;

  // Find tournament chats
  const chats = await db.groupChat.findMany({
    where: {
      tournamentId,
      type: { in: ['TOURNAMENT_GENERAL', 'TOURNAMENT_ANNOUNCEMENTS'] as ChatType[] },
    },
  });

  for (const chat of chats) {
    try {
      // Get user info before removing
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      await db.groupChatMember.delete({
        where: {
          chatId_userId: {
            chatId: chat.id,
            userId,
          },
        },
      });

      removed = true;

      // Add leave message to general chat
      if (chat.type === 'TOURNAMENT_GENERAL' && user) {
        await db.groupChatMessage.create({
          data: {
            chatId: chat.id,
            senderId: userId,
            content: `${user.firstName} ${user.lastName} left the chat`,
            type: 'SYSTEM' as MessageType,
          },
        });
      }
    } catch {
      // Not a member
    }
  }

  return { removed };
}

/**
 * Make tournament chats read-only when tournament completes
 */
export async function closeTournamentChats(tournamentId: string): Promise<void> {
  await db.groupChat.updateMany({
    where: {
      tournamentId,
      type: 'TOURNAMENT_GENERAL' as ChatType,
    },
    data: {
      isReadOnly: true,
      isActive: false,
    },
  });

  // Add closing message
  const chats = await db.groupChat.findMany({
    where: { tournamentId },
  });

  for (const chat of chats) {
    await db.groupChatMessage.create({
      data: {
        chatId: chat.id,
        senderId: chat.createdById,
        content: 'This tournament has ended. The chat is now closed.',
        type: 'SYSTEM' as MessageType,
      },
    });
  }
}

/**
 * Post an announcement to tournament chat
 */
export async function postTournamentAnnouncement(
  tournamentId: string,
  message: string,
  senderId: string
): Promise<void> {
  const announcementsChat = await db.groupChat.findUnique({
    where: {
      tournamentId_type: {
        tournamentId,
        type: 'TOURNAMENT_ANNOUNCEMENTS' as ChatType,
      },
    },
  });

  if (announcementsChat) {
    await db.groupChatMessage.create({
      data: {
        chatId: announcementsChat.id,
        senderId,
        content: message,
        type: 'ANNOUNCEMENT' as MessageType,
      },
    });

    // Also post to general chat
    const generalChat = await db.groupChat.findUnique({
      where: {
        tournamentId_type: {
          tournamentId,
          type: 'TOURNAMENT_GENERAL' as ChatType,
        },
      },
    });

    if (generalChat) {
      await db.groupChatMessage.create({
        data: {
          chatId: generalChat.id,
          senderId,
          content: `📢 Announcement: ${message}`,
          type: 'ANNOUNCEMENT' as MessageType,
        },
      });
    }
  }
}
