import { NextResponse } from "next/server";
import { getGoogleAuthServerConfig } from "@/lib/google-auth-config";

export async function GET() {
  const config = getGoogleAuthServerConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        success: false,
        enabled: false,
        message: "Google sign-in is not configured right now.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    success: true,
    enabled: true,
    clientId: config.clientId,
  });
}
