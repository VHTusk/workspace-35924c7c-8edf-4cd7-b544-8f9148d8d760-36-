import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session-helpers";
import { getSportSlug } from "@/lib/sports";
import type { SportType } from "@prisma/client";

export default async function PostLoginPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    redirect("/select-sport");
  }

  const session = await validateSession(sessionToken);
  const sport = session?.user?.sport;

  if (!sport || typeof sport !== "string") {
    redirect("/select-sport");
  }

  redirect(`/${getSportSlug(sport as SportType)}/dashboard`);
}
