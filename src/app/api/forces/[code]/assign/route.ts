import { NextResponse } from "next/server";

function disabledResponse() {
  return NextResponse.json(
    {
      error: "Force features are not part of the MVP deployment.",
      status: "disabled",
    },
    { status: 501 }
  );
}

export async function POST() {
  return disabledResponse();
}

export async function DELETE() {
  return disabledResponse();
}
