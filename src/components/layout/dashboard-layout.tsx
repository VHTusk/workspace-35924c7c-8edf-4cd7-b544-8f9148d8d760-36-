"use client";

import { ReactNode } from "react";
import Sidebar from "./sidebar";
import SidebarOrg from "./sidebar-org";
import SidebarAdmin from "./sidebar-admin";

interface DashboardLayoutProps {
  children: ReactNode;
  userType?: "player" | "org" | "admin";
  /** Maximum width for content. Use 'full' for no max-width, or Tailwind max-w-* classes */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";
  /** Additional padding classes */
  padding?: string;
  /** Whether to show the sidebar */
  showSidebar?: boolean;
}

/**
 * DashboardLayout - Centralized layout component for dashboard pages
 * 
 * This component handles the sidebar and main content area consistently.
 * The content starts immediately after the sidebar with no gap.
 * 
 * Usage:
 * ```tsx
 * <DashboardLayout userType="player">
 *   <YourPageContent />
 * </DashboardLayout>
 * ```
 */
export function DashboardLayout({
  children,
  userType = "player",
  maxWidth = "6xl",
  padding = "p-6",
  showSidebar = true,
}: DashboardLayoutProps) {
  // Sidebar width is 288px (w-72 = 18rem = 288px)
  // Main content should start immediately after sidebar
  
  const SidebarComponent = userType === "admin" 
    ? SidebarAdmin 
    : userType === "org" 
      ? SidebarOrg 
      : Sidebar;

  const maxWidthClass = maxWidth === "full" ? "" : `max-w-${maxWidth}`;

  return (
    <div className="min-h-screen bg-background">
      {showSidebar && <SidebarComponent />}
      <main className={`${showSidebar ? "ml-0 md:ml-72" : ""} min-h-screen`}>
        <div className={`${padding} ${maxWidthClass}`}>
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * DashboardPageHeader - Consistent page header for dashboard pages
 */
interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function DashboardPageHeader({
  title,
  description,
  action,
  className = "",
}: DashboardPageHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export default DashboardLayout;
