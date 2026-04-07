import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { logLogoutEvent } from "@/lib/audit-logger";
import { log } from "@/lib/logger";
import { hashToken } from "@/lib/auth";
import { clearSessionCookieFromStore } from "@/lib/session-helpers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    
    // Get user info before clearing session for audit logging
    let userId: string | null = null;
    let sport: string | null = null;
    
    if (sessionToken) {
      // Hash the token before lookup - tokens are stored as hashes
      const tokenHash = await hashToken(sessionToken);
      
      const session = await db.session.findUnique({
        where: { token: tokenHash },
        include: { user: { select: { id: true, sport: true, role: true } } },
      });
      
      if (session?.user) {
        userId = session.user.id;
        sport = session.user.sport;
        
        // Log logout event
        logLogoutEvent(userId, session.user.sport, request, {
          role: session.user.role,
        }).catch(err => log.error('Failed to log logout event', { error: err }));
      }
    }
    
    // Clear session cookie using shared helper for consistent path
    clearSessionCookieFromStore(cookieStore);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
