import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Coupon support is not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}
