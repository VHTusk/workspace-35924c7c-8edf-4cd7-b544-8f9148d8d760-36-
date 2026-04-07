import { NextResponse } from "next/server";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Alert rule management is not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function PATCH() {
  return disabledResponse();
}

export async function DELETE() {
  return disabledResponse();
}
