import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { FriendRequestSetting, MessageSetting } from "@prisma/client";

// GET endpoint to fetch privacy settings
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;

    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        // Contact information visibility
        showPhone: true,
        showEmail: true,
        // Profile information visibility
        showRealName: true,
        showLocation: true,
        showTournamentHistory: true,
        // Interaction settings
        allowFriendRequestsFrom: true,
        allowMessagesFrom: true,
      },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(userData);
  } catch (error) {
    console.error("Error fetching privacy settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT endpoint to update privacy settings
// Note: profileVisibility, showOnLeaderboard, and hideElo are NOT changeable
// as this is a public competitive platform where rankings must be visible
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;

    const body = await request.json();
    const {
      showPhone,
      showEmail,
      showRealName,
      showLocation,
      showTournamentHistory,
      allowFriendRequestsFrom,
      allowMessagesFrom,
    } = body;

    // Validate enum values
    const validFriendRequestSettings = Object.values(FriendRequestSetting);
    const validMessageSettings = Object.values(MessageSetting);

    if (allowFriendRequestsFrom && !validFriendRequestSettings.includes(allowFriendRequestsFrom)) {
      return NextResponse.json({ error: "Invalid friend request setting value" }, { status: 400 });
    }

    if (allowMessagesFrom && !validMessageSettings.includes(allowMessagesFrom)) {
      return NextResponse.json({ error: "Invalid message setting value" }, { status: 400 });
    }

    // Build update data object with only allowed fields
    const updateData: Record<string, unknown> = {};
    
    // Contact information visibility
    if (showPhone !== undefined) updateData.showPhone = showPhone;
    if (showEmail !== undefined) updateData.showEmail = showEmail;
    
    // Profile information visibility
    if (showRealName !== undefined) updateData.showRealName = showRealName;
    if (showLocation !== undefined) updateData.showLocation = showLocation;
    if (showTournamentHistory !== undefined) updateData.showTournamentHistory = showTournamentHistory;
    
    // Interaction settings
    if (allowFriendRequestsFrom !== undefined) updateData.allowFriendRequestsFrom = allowFriendRequestsFrom;
    if (allowMessagesFrom !== undefined) updateData.allowMessagesFrom = allowMessagesFrom;

    // Update user privacy settings
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        showPhone: true,
        showEmail: true,
        showRealName: true,
        showLocation: true,
        showTournamentHistory: true,
        allowFriendRequestsFrom: true,
        allowMessagesFrom: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating privacy settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
