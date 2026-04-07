import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;

    // Get active subscription
    const activeSubscription = await db.subscription.findFirst({
      where: {
        userId: user.id,
        sport: user.sport,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
    })

    if (activeSubscription) {
      const endDate = new Date(activeSubscription.endDate)
      const now = new Date()
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      return NextResponse.json({
        isSubscribed: true,
        plan: activeSubscription.amount >= 5000 ? "Elite" : "Pro",
        startDate: activeSubscription.startDate.toISOString(),
        endDate: endDate.toISOString(),
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      })
    }

    return NextResponse.json({
      isSubscribed: false,
      plan: null,
      startDate: null,
      endDate: null,
      daysRemaining: null,
    })
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user, session } = auth;

    const body = await request.json()
    const { plan } = body

    if (!plan || !["pro", "elite"].includes(plan.toLowerCase())) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    // Calculate pro-rata pricing based on Indian Financial Year
    const now = new Date()
    const currentMonth = now.getMonth()
    let fyEndYear = now.getFullYear()
    if (currentMonth < 3) {
      fyEndYear = now.getFullYear()
    } else {
      fyEndYear = now.getFullYear() + 1
    }
    
    const fyEnd = new Date(fyEndYear, 2, 31) // March 31
    
    // Calculate months remaining
    const monthsRemaining = 12 - (currentMonth >= 3 ? currentMonth - 3 : currentMonth + 9)
    
    const monthlyPrice = plan.toLowerCase() === "elite" ? 599 : 299
    const totalAmount = Math.round(monthlyPrice * monthsRemaining)

    // Create subscription
    const subscription = await db.subscription.create({
      data: {
        userId: user.id,
        sport: user.sport,
        status: "ACTIVE",
        startDate: now,
        endDate: fyEnd,
        amount: totalAmount,
      },
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan: plan,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        amount: subscription.amount,
      },
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
