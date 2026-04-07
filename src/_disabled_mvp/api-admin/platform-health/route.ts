import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Platform health monitoring is not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}
