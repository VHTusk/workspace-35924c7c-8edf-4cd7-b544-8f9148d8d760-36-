"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SchoolTeamsRedirectPage() {
  const params = useParams();
  const sport = params.sport as string;

  useEffect(() => {
    // Redirect to new school teams location
    window.location.href = `/${sport}/org/school/inter/teams`;
  }, [sport]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}
