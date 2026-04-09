"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EmployerSportsLeaderboardRedirect() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    router.replace(`/${sport}/org/corporate/intra/leaderboard`);
  }, [sport, router]);

  return null;
}
