"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RecapRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    // Redirect to current year recap
    const currentYear = new Date().getFullYear();
    router.replace(`/${sport}/recap/${currentYear}`);
  }, [sport, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🏆</span>
        </div>
        <p className="text-white/80">Loading your season recap...</p>
      </div>
    </div>
  );
}
