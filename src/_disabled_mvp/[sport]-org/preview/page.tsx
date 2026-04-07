"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { SportPreviewPage } from "@/components/org/sport-preview-page";
import { Loader2 } from "lucide-react";

export default function SportPreviewRoute() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("Organization");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    fetchOrgData();
  }, [sport]);

  const fetchOrgData = async () => {
    setLoading(true);
    try {
      // Get org info
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrgId(data.id);
        setOrgName(data.name || "Organization");

        // Check subscription status for this sport
        if (data.id) {
          const sportsResponse = await fetch(`/api/orgs/${data.id}/sports`);
          if (sportsResponse.ok) {
            const sportsData = await sportsResponse.json();
            const sportSub = sportsData.sports?.find(
              (s: { id: string; status: string }) => s.id === sport?.toLowerCase()
            );

            // If already subscribed, redirect to workspace
            if (sportSub && sportSub.status === "ACTIVE") {
              setIsSubscribed(true);
              router.replace(`/${sport}/org/corporate/intra`);
              return;
            }
          }
        }
      } else {
        // Redirect to login if not authenticated
        router.push("/org/login");
      }
    } catch (error) {
      console.error("Failed to fetch org data:", error);
      router.push("/org/login");
    } finally {
      setLoading(false);
    }
  };

  // Redirecting state for subscribed users
  if (loading && isSubscribed) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Sidebar userType="org" />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-500" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">You're already subscribed! Redirecting to workspace...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loading || !orgId) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Sidebar userType="org" />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading preview...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          <SportPreviewPage
            sport={sport}
            orgId={orgId}
            orgName={orgName}
          />
        </div>
      </main>
    </div>
  );
}
