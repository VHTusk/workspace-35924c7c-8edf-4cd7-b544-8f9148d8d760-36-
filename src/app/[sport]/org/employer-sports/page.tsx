"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Redirect: Employer Sports → Intra Corporate
 * 
 * Old terminology: "Employer Sports"
 * New terminology: "Intra Corporate"
 */
export default function EmployerSportsRedirect() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    router.replace(`/${sport}/org/corporate/intra`);
  }, [sport, router]);

  return null;
}
