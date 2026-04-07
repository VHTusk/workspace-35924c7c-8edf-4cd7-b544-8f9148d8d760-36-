import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedDirector } from "@/lib/auth";
import { Role, ContractStatus } from "@prisma/client";

// GET - Get all contracts (platform admin view)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDirector(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status && ["PENDING", "ACTIVE", "EXPIRED", "TERMINATED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const [contracts, total] = await Promise.all([
      db.playerContract.findMany({
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
              playerOrgType: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.playerContract.count({ where }),
    ]);

    // Get stats
    const stats = {
      pending: await db.playerContract.count({ where: { status: "PENDING" } }),
      active: await db.playerContract.count({ where: { status: "ACTIVE" } }),
      expired: await db.playerContract.count({ where: { status: "EXPIRED" } }),
      terminated: await db.playerContract.count({ where: { status: "TERMINATED" } }),
      rejected: await db.playerContract.count({ where: { status: "REJECTED" } }),
    };

    return NextResponse.json({
      contracts: contracts.map((c) => ({
        id: c.id,
        player: {
          id: c.player.id,
          name: `${c.player.firstName} ${c.player.lastName}`,
          email: c.player.email,
          phone: c.player.phone,
          elo: c.player.hiddenElo,
          playerOrgType: c.player.playerOrgType,
        },
        organization: {
          id: c.organization.id,
          name: c.organization.name,
          type: c.organization.type,
        },
        contractTitle: c.contractTitle,
        contractType: c.contractType,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        verifiedAt: c.verifiedAt,
        rejectionReason: c.rejectionReason,
        createdAt: c.createdAt,
      })),
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching admin contracts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
