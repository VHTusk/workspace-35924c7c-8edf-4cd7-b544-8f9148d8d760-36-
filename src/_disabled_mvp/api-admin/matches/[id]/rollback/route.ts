import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Admin match management is not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Admin match management is not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}
