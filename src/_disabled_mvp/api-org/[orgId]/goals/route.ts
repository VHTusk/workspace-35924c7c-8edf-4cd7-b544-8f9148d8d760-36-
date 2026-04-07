import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const sport = request.nextUrl.searchParams.get("sport") || "CORNHOLE";

    const goals = await db.participationGoal.findMany({
      where: {
        orgId,
        sport: sport as Prisma.SportType,
      },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const {
      goalType,
      targetValue,
      period,
      startDate,
      endDate,
      departmentId,
      rewardType,
      rewardValue,
    } = body;

    const goal = await db.participationGoal.create({
      data: {
        orgId,
        sport: body.sport || "CORNHOLE",
        goalType,
        targetValue: parseFloat(targetValue),
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        departmentId: departmentId || null,
        rewardType: rewardType || null,
        rewardValue: rewardValue || null,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const { goalId, currentValue, isAchieved } = body;

    const goal = await db.participationGoal.update({
      where: { id: goalId, orgId },
      data: {
        currentValue,
        isAchieved: isAchieved || false,
        achievedAt: isAchieved ? new Date() : null,
      },
    });

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}
