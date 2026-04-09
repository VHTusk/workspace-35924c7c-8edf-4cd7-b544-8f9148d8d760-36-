"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Corporate Entry Point
 * 
 * Redirects to Intra Corporate dashboard by default.
 * This provides a clean entry point to the corporate section.
 */
export default function CorporatePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    // Default to Intra Corporate mode
    router.replace(`/${sport}/org/corporate/intra`);
  }, [sport, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading Corporate Dashboard...</p>
      </div>
    </div>
  );
}
