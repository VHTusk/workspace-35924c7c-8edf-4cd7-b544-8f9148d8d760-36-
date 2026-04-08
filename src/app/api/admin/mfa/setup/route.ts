import { NextRequest, NextResponse } from "next/server";
import { enableMfa, setupMfa } from "@/lib/mfa";
import { getAuthenticatedAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email || "admin@valorhive.com";
    const result = await setupMfa(session.user.id, email);

    return NextResponse.json({
      success: true,
      data: {
        secret: result.secret,
        otpAuthUrl: result.otpAuthUrl,
        recoveryCodes: result.recoveryCodes,
      },
    });
  } catch (error) {
    console.error("Admin MFA setup error:", error);
    return NextResponse.json({ error: "Failed to set up MFA" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedAdmin(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { code?: string };
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!code) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
    }

    const result = await enableMfa(session.user.id, code);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Invalid verification code" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "MFA enabled successfully",
    });
  } catch (error) {
    console.error("Admin MFA verification error:", error);
    return NextResponse.json({ error: "Failed to enable MFA" }, { status: 500 });
  }
}
