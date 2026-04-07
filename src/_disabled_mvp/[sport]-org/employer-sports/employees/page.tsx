"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EmployerSportsEmployeesRedirect() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    router.replace(`/${sport}/org/corporate/intra/employees`);
  }, [sport, router]);

  return null;
}
