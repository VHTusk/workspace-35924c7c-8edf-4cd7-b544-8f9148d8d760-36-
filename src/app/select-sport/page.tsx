import { cookies } from "next/headers";
import { parsePendingGoogleOneTapState, GOOGLE_ONE_TAP_PENDING_COOKIE } from "@/lib/google-one-tap";
import { SelectSportClient } from "./select-sport-client";

export default async function SelectSportPage() {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(GOOGLE_ONE_TAP_PENDING_COOKIE)?.value;
  const pendingState = parsePendingGoogleOneTapState(pendingToken);

  return <SelectSportClient hasPendingGoogleSelection={pendingState !== null} />;
}
