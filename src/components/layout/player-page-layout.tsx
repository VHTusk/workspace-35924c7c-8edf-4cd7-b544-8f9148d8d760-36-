"use client";

import Sidebar from "@/components/layout/sidebar";
import SiteFooter from "@/components/layout/site-footer";
import { usePathname } from "next/navigation";

interface PlayerPageLayoutProps {
  children: React.ReactNode;
  userType?: "player" | "org";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  showFooter?: boolean;
  className?: string;
}

/**
 * Unified layout component for pages that need sidebar navigation.
 * This ensures consistent sidebar positioning across all pages.
 * 
 * Key features:
 * - Fixed sidebar on desktop (w-72 / 288px)
 * - Sheet overlay sidebar on mobile
 * - Proper content offset (md:ml-72) without centering gaps
 * - Consistent padding and max-width handling
 * 
 * Usage:
 * <PlayerPageLayout userType="player" maxWidth="lg">
 *   <YourPageContent />
 * </PlayerPageLayout>
 */
export default function PlayerPageLayout({
  children,
  userType = "player",
  maxWidth = "lg",
  showFooter = true,
  className = "",
}: PlayerPageLayoutProps) {
  const pathname = usePathname();

  // Detect if this is an org route for sidebar type
  const isOrgRoute = pathname?.includes('/org/');
  const effectiveUserType = isOrgRoute ? "org" : userType;

  // Max width classes - do NOT use mx-auto to avoid centering gaps
  const maxWidthClasses = {
    sm: "max-w-3xl",    // 768px
    md: "max-w-4xl",    // 896px
    lg: "max-w-5xl",    // 1024px
    xl: "max-w-6xl",    // 1152px
    full: "max-w-full", // Full width
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Sidebar - Fixed position on desktop, Sheet on mobile */}
      <Sidebar userType={effectiveUserType} />
      
      {/* Main Content Area - Offset for fixed sidebar on desktop */}
      <main className="ml-0 md:ml-72 min-h-screen">
        {/* Content container with consistent padding and max-width */}
        <div className={`p-4 md:p-6 ${maxWidthClasses[maxWidth]} ${className}`}>
          {children}
        </div>
        
        {/* Optional footer */}
        {showFooter && <SiteFooter />}
      </main>
    </div>
  );
}
