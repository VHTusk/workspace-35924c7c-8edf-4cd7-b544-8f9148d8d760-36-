"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CompetitiveRepTournamentsRedirect() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    router.replace(`/${sport}/org/corporate/inter/tournaments`);
  }, [sport, router]);

  return null;
}
