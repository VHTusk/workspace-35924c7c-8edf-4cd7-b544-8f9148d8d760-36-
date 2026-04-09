import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateOrgSession } from "@/lib/auth";

// GET - Get all verification requests for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await validateOrgSession(
      request.cookies.get("session_token")?.value || ""
    );

    if (!session || !session.org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.org.id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where clause
    const where: Record<string, unknown> = { organizationId: orgId };
    if (status && ["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    // Get verification requests
    const verifications = await db.playerIdVerification.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            hiddenElo: true,
            visiblePoints: true,
            playerOrgType: true,
            verificationStatus: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get stats
    const stats = {
      pending: await db.playerIdVerification.count({
        where: { organizationId: orgId, status: "PENDING" },
      }),
      verified: await db.playerIdVerification.count({
        where: { organizationId: orgId, status: "VERIFIED" },
      }),
      rejected: await db.playerIdVerification.count({
        where: { organizationId: orgId, status: "REJECTED" },
      }),
    };

    return NextResponse.json({
      verifications: verifications.map((v) => ({
        id: v.id,
        player: {
          id: v.player.id,
          firstName: v.player.firstName,
          lastName: v.player.lastName,
          name: `${v.player.firstName} ${v.player.lastName}`,
          email: v.player.email,
          phone: v.player.phone,
          elo: v.player.hiddenElo,
          points: v.player.visiblePoints,
          playerOrgType: v.player.playerOrgType,
          city: v.player.city,
          state: v.player.state,
        },
        documentUrl: v.documentUrl,
        documentType: v.documentType,
        status: v.status,
        verifiedAt: v.verifiedAt,
        verifiedBy: v.verifiedBy,
        rejectionReason: v.rejectionReason,
        createdAt: v.createdAt,
      })),
      stats,
    });
  } catch (error) {
    console.error("Error fetching verifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
