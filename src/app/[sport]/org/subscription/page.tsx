"use client";

import { useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect to org-level subscription page
 * Old route: /[sport]/org/subscription
 * New route: /org/subscription
 */
export default function SportSubscriptionRedirect() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sport = params.sport as string;

  useEffect(() => {
    // Preserve any query params like ?sport=cornhole
    const sportParam = searchParams.get("sport") || sport;
    const activateParam = searchParams.get("activate");
    
    let redirectUrl = "/org/subscription";
    const queryParams = new URLSearchParams();
    
    if (sportParam) {
      queryParams.set("sport", sportParam);
    }
    if (activateParam) {
      queryParams.set("activate", activateParam);
    }
    
    if (queryParams.toString()) {
      redirectUrl += `?${queryParams.toString()}`;
    }
    
    router.replace(redirectUrl);
  }, [router, sport, searchParams]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Redirecting to subscriptions...</p>
      </div>
    </div>
  );
}
