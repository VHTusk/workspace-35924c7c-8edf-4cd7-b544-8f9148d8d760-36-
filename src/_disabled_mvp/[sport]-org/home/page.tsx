"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect to org-level home page
 * Old route: /[sport]/org/home
 * New route: /org/home
 */
export default function OrgHomeRedirect() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  useEffect(() => {
    // Redirect to org-level home (sport-agnostic)
    router.replace("/org/home");
  }, [router]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Redirecting to organization home...</p>
      </div>
    </div>
  );
}
