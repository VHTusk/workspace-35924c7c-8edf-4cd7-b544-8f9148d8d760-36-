"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import SidebarOrg from "@/components/layout/sidebar-org";
import { OrganizationHeaderContext } from "@/components/org/organization-header-context";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface OrganizationLayoutWrapperProps {
  children: React.ReactNode;
}

interface SportSubscription {
  id: string;  // Changed from 'sport' to match API response
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED";
}

// Route classification helpers
function isAuthPage(pathname: string): boolean {
  return pathname.includes("/org/login") || pathname.includes("/org/register");
}

function isOrgLevelPage(pathname: string): boolean {
  // Org-level pages that don't require sport subscription
  const orgLevelPatterns = [
    "/org/home",
    "/org/subscription",
    "/org/settings",
    "/org/profile",
    "/org/admins",
  ];
  return orgLevelPatterns.some(pattern => pathname.startsWith(pattern));
}

function isPreviewPage(pathname: string): boolean {
  return pathname.includes("/org/preview");
}

function isCorporateWorkspace(pathname: string): boolean {
  // Sport-specific corporate workspace pages
  return pathname.includes("/org/corporate/");
}

function isSchoolWorkspace(pathname: string): boolean {
  // Sport-specific school workspace pages (canonical routes)
  return pathname.includes("/org/school/");
}

/**
 * OrganizationLayoutWrapper
 * 
 * Handles layout and subscription gating for organization pages:
 * - Auth pages (login/register): No sidebar
 * - Org-level pages: Use OrgSidebar (no subscription check needed)
 * - Sport workspace pages: Use SidebarOrg with subscription check
 * 
 * Subscription gating:
 * - Only sport workspace pages require subscription check
 * - Org-level pages (home, subscription, settings) are always accessible
 */
export default function OrganizationLayoutWrapper({ children }: OrganizationLayoutWrapperProps) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SportSubscription[]>([]);
  const [hasAccess, setHasAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Classify the current route
  const authPage = isAuthPage(pathname);
  const orgLevel = isOrgLevelPage(pathname);
  const previewPage = isPreviewPage(pathname);
  const corporateWorkspace = isCorporateWorkspace(pathname);
  const schoolWorkspace = isSchoolWorkspace(pathname);

  // Determine if subscription check is needed (corporate or school workspace)
  const needsSubscriptionCheck = (corporateWorkspace || schoolWorkspace) && !previewPage;

  useEffect(() => {
    // Skip subscription check for auth, org-level, and preview pages
    if (authPage || orgLevel || previewPage || !needsSubscriptionCheck) {
      setLoading(false);
      return;
    }

    checkSubscription();
  }, [sport, pathname, needsSubscriptionCheck]);

  const checkSubscription = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get org info
      const orgResponse = await fetch("/api/org/me", { credentials: "include" });
      
      if (!orgResponse.ok) {
        if (orgResponse.status === 401) {
          // Not logged in - redirect to org login
          router.push("/org/login");
          return;
        }
        throw new Error("Failed to fetch organization data");
      }
      
      const orgData = await orgResponse.json();
      setOrgId(orgData.id);

      // Get sport subscriptions
      const sportsResponse = await fetch(`/api/orgs/${orgData.id}/sports`, {
        credentials: "include",
      });
      
      if (sportsResponse.ok) {
        const data = await sportsResponse.json();
        setSubscriptions(data.sports || []);
        
        // Check if current sport is subscribed (ACTIVE only)
        const sportSub = data.sports?.find(
          (s: SportSubscription) => s.id === sport?.toLowerCase()
        );
        
        if (sportSub && sportSub.status === "ACTIVE") {
          setHasAccess(true);
        } else {
          // Not subscribed - redirect to preview
          setHasAccess(false);
          router.replace(`/${sport}/org/preview`);
        }
      } else {
        throw new Error("Failed to fetch subscriptions");
      }
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setError(err instanceof Error ? err.message : "Failed to check subscription");
      setHasAccess(false);
      router.replace(`/${sport}/org/preview`);
    } finally {
      setLoading(false);
    }
  };

  // Auth pages: no wrapper, just children
  if (authPage) {
    return <>{children}</>;
  }

  // Loading state for subscription check
  if (loading && needsSubscriptionCheck) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && needsSubscriptionCheck) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={checkSubscription} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // No access - will be redirected by router
  if (!hasAccess && needsSubscriptionCheck) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Redirecting to preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Use appropriate sidebar based on page type */}
      {corporateWorkspace || schoolWorkspace ? (
        <SidebarOrg />
      ) : (
        <Sidebar userType="org" />
      )}

      <main className="ml-0 md:ml-72">
        {/* Organization Header Context - for corporate or school workspace */}
        {(corporateWorkspace || schoolWorkspace) && <OrganizationHeaderContext />}

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
