import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { getAuthenticatedDirector } from "@/lib/auth";

// GET - Get all verification requests (platform admin view)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Build where clause
    const where: Record<string, unknown> = {};
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
            city: true,
            state: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get stats
    const stats = {
      total: await db.playerIdVerification.count(),
      pending: await db.playerIdVerification.count({ where: { status: "PENDING" } }),
      verified: await db.playerIdVerification.count({ where: { status: "VERIFIED" } }),
      rejected: await db.playerIdVerification.count({ where: { status: "REJECTED" } }),
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
        organization: {
          id: v.organization.id,
          name: v.organization.name,
          type: v.organization.type,
          city: v.organization.city,
          state: v.organization.state,
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
    console.error("Error fetching admin verifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
