"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface SubscriptionGateProps {
  sport: string;
  orgId: string;
  children: React.ReactNode;
  fallbackPath?: string;
}

interface SportSubscription {
  id: string;
  sport: string;
  status: "ACTIVE" | "TRIAL" | "INACTIVE" | "EXPIRED" | "SUSPENDED";
  planType: "ROOKIE" | "PRO" | "ELITE";
  activatedAt?: string;
  expiresAt?: string;
  trialEndsAt?: string;
}

/**
 * SubscriptionGate - Controls access to sport-specific corporate workspaces
 * 
 * Behavior:
 * - ACTIVE: Allow full access to sport workspace
 * - TRIAL: Allow access with trial limits
 * - INACTIVE/EXPIRED/SUSPENDED: Redirect to preview page
 */
export function SubscriptionGate({ sport, orgId, children, fallbackPath }: SubscriptionGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SportSubscription | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, [sport, orgId]);

  const checkSubscription = async () => {
    setLoading(true);
    try {
      // Fetch sport-specific subscription status
      const response = await fetch(`/api/orgs/${orgId}/sports`);
      if (response.ok) {
        const data = await response.json();
        const sportSub = data.sports?.find((s: SportSubscription) => s.sport === sport.toUpperCase());
        
        if (sportSub) {
          setSubscription(sportSub);
          const isAccessible = sportSub.status === "ACTIVE" || sportSub.status === "TRIAL";
          setHasAccess(isAccessible);
          
          if (!isAccessible) {
            // Redirect to preview page for unsubscribed sports
            const previewPath = fallbackPath || `/${sport}/org/preview`;
            router.replace(previewPath);
          }
        } else {
          // No subscription record - treat as inactive
          setHasAccess(false);
          const previewPath = fallbackPath || `/${sport}/org/preview`;
          router.replace(previewPath);
        }
      } else {
        // API error - default to no access for safety
        setHasAccess(false);
        const previewPath = fallbackPath || `/${sport}/org/preview`;
        router.replace(previewPath);
      }
    } catch (error) {
      console.error("Failed to check subscription:", error);
      setHasAccess(false);
      const previewPath = fallbackPath || `/${sport}/org/preview`;
      router.replace(previewPath);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Redirecting to preview...</p>
        </div>
      </div>
    );
  }

  // Render children with subscription context
  return (
    <SubscriptionContext.Provider value={{ subscription, isTrial: subscription?.status === "TRIAL" }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// Context for subscription state
import { createContext, useContext } from "react";

interface SubscriptionContextType {
  subscription: SportSubscription | null;
  isTrial: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  isTrial: false,
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

/**
 * Higher-order component version for wrapping pages
 */
export function withSubscriptionGate<P extends object>(
  Component: React.ComponentType<P>,
  getSportAndOrgId: (props: P) => { sport: string; orgId: string }
) {
  return function SubscriptionGateWrapper(props: P) {
    const { sport, orgId } = getSportAndOrgId(props);
    
    return (
      <SubscriptionGate sport={sport} orgId={orgId}>
        <Component {...props} />
      </SubscriptionGate>
    );
  };
}
