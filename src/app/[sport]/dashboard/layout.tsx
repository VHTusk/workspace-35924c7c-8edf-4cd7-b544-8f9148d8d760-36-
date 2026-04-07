"use client";

import { useParams, usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import SiteFooter from "@/components/layout/site-footer";
import { OnboardingModal, useOnboarding } from "@/components/onboarding/onboarding-modal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const sport = params.sport as string;
  
  // Onboarding hook for new users
  const sportType = (sport === "cornhole" || sport === "darts") ? sport : "cornhole";
  const { showOnboarding, userName, closeOnboarding } = useOnboarding(sportType);

  // Detect if this is an org route
  const isOrgRoute = pathname?.includes('/org/');
  const userType = isOrgRoute ? "org" : "player";
  const themeClass = sport === "cornhole" ? "theme-cornhole" : "theme-darts";

  return (
    <div className={`min-h-screen bg-background ${themeClass}`}>
      {/* Unified Sidebar - fixed position */}
      <Sidebar userType={userType} />

      {/* Main Content Area - starts immediately after sidebar on desktop */}
      <main id="main-content" className="ml-0 md:ml-72 min-h-screen">
        {children}
      </main>
      
      {/* Onboarding Modal for New Users */}
      <OnboardingModal
        sport={sportType}
        userName={userName}
        isOpen={showOnboarding}
        onClose={closeOnboarding}
      />
    </div>
  );
}
