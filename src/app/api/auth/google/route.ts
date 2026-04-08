import { NextRequest, NextResponse } from "next/server";
import { normalizeSport } from "@/lib/sports";
import { getSportSlug } from "@/lib/sports";

export async function GET(request: NextRequest) {
  const requestedSport = normalizeSport(request.nextUrl.searchParams.get("sport"));

  if (requestedSport) {
    return NextResponse.redirect(new URL(`/${getSportSlug(requestedSport)}/login?google=1`, request.url));
  }

  return NextResponse.redirect(new URL("/?auth=login&google=1", request.url));
}
