import { NextResponse } from "next/server";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Manual no-show cron fallback is not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
