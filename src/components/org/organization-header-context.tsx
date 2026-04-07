"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Building2,
  Shield,
  ChevronRight,
  GraduationCap,
  School,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CorporateModeToggleCompact, type CorporateMode } from "@/components/corporate/corporate-mode-toggle";
import { useState, useEffect } from "react";

interface OrganizationHeaderContextProps {
  className?: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
  email?: string;
  city?: string;
  state?: string;
}

// Available sports configuration
const AVAILABLE_SPORTS = [
  { id: "cornhole", name: "Cornhole", icon: "🎯" },
  { id: "darts", name: "Darts", icon: "🎯" },
  { id: "badminton", name: "Badminton", icon: "🏸" },
  { id: "cricket", name: "Cricket", icon: "🏏" },
  { id: "football", name: "Football", icon: "⚽" },
  { id: "table-tennis", name: "Table Tennis", icon: "🏓" },
];

export function OrganizationHeaderContext({ className }: OrganizationHeaderContextProps) {
  const params = useParams();
  const pathname = usePathname();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [org, setOrg] = useState<OrgData | null>(null);

  // Detect corporate mode from URL
  const isCorporateSection = pathname.includes("/org/corporate/");
  const getCorporateMode = (): CorporateMode | null => {
    if (pathname.includes("/org/corporate/intra")) return "intra";
    if (pathname.includes("/org/corporate/inter")) return "inter";
    return null;
  };
  const corporateMode = getCorporateMode();

  // Get current sport info
  const currentSportInfo = AVAILABLE_SPORTS.find(s => s.id === sport);

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const response = await fetch("/api/org/me");
        if (response.ok) {
          const data = await response.json();
          setOrg({
            id: data.id,
            name: data.name,
            type: data.type,
            email: data.email,
            city: data.city,
            state: data.state,
          });
        }
      } catch (error) {
        console.error("Failed to fetch org data:", error);
      }
    };

    fetchOrgData();
  }, [sport]);

  // Get org type icon and label
  const getOrgTypeInfo = (type: string) => {
    switch (type) {
      case "CORPORATE":
        return { icon: Building2, label: "Corporate", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" };
      case "SCHOOL":
        return { icon: School, label: "School", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
      case "COLLEGE":
        return { icon: GraduationCap, label: "College", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" };
      case "CLUB":
        return { icon: Users, label: "Club", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
      default:
        return { icon: Building2, label: type, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" };
    }
  };

  const orgTypeInfo = org?.type ? getOrgTypeInfo(org.type) : null;
  const OrgIcon = orgTypeInfo?.icon || Building2;

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  // Build breadcrumb with clickable links
  const buildBreadcrumb = () => {
    const parts = [];

    // Organization name - links to org home
    parts.push({
      label: org?.name || "Organization",
      icon: OrgIcon,
      href: "/org/home",
    });

    // Sport name - links to sport workspace
    if (currentSportInfo) {
      const sportHref = corporateMode === "inter"
        ? `/${sport}/org/corporate/inter`
        : `/${sport}/org/corporate/intra`;
      parts.push({
        label: `${currentSportInfo.icon} ${currentSportInfo.name}`,
        icon: null,
        href: sportHref,
      });
    }

    // Mode (Internal/External)
    if (corporateMode) {
      parts.push({
        label: corporateMode === "intra" ? "Internal" : "External",
        icon: corporateMode === "intra" ? Building2 : Shield,
        href: null, // Current page, not clickable
      });
    }

    return parts;
  };

  const breadcrumb = buildBreadcrumb();

  return (
    <div className={cn("bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700", className)}>
      {/* Single Row - Breadcrumb + Mode Toggle */}
      <div className="px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Dashboard Link + Breadcrumb */}
          <div className="flex items-center gap-2">
            <Link
              href="/org/home"
              className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <ChevronRight className="w-4 h-4 text-gray-400" />

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm">
              {breadcrumb.map((part, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
                  {part.href ? (
                    <Link
                      href={part.href}
                      className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      {part.icon && <part.icon className="w-4 h-4" />}
                      <span className={cn(
                        "font-medium",
                        index === breadcrumb.length - 1 && primaryTextClass
                      )}>
                        {part.label}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                      {part.icon && <part.icon className="w-4 h-4" />}
                      <span className={cn(
                        "font-medium",
                        index === breadcrumb.length - 1 && primaryTextClass
                      )}>
                        {part.label}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Mode Toggle + Org Type Badge */}
          <div className="flex items-center gap-3">
            {/* Corporate Mode Toggle (only show in corporate section) */}
            {isCorporateSection && corporateMode && (
              <CorporateModeToggleCompact currentMode={corporateMode} />
            )}

            {/* Org Type Badge */}
            {org && (
              <Badge className={cn("text-xs", orgTypeInfo?.color || "bg-gray-100 text-gray-700")}>
                <OrgIcon className="w-3 h-3 mr-1" />
                {orgTypeInfo?.label}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact version for embedding in other components
export function OrganizationBreadcrumb({ className }: { className?: string }) {
  const params = useParams();
  const pathname = usePathname();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [orgName, setOrgName] = useState<string>("Organization");

  const isCorporateSection = pathname.includes("/org/corporate/");
  const getCorporateMode = (): CorporateMode | null => {
    if (pathname.includes("/org/corporate/intra")) return "intra";
    if (pathname.includes("/org/corporate/inter")) return "inter";
    return null;
  };
  const corporateMode = getCorporateMode();

  const currentSportInfo = AVAILABLE_SPORTS.find(s => s.id === sport);
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    const fetchOrgName = async () => {
      try {
        const response = await fetch("/api/org/me");
        if (response.ok) {
          const data = await response.json();
          setOrgName(data.name);
        }
      } catch {
        // ignore
      }
    };
    fetchOrgName();
  }, []);

  const breadcrumb = [
    { label: orgName, href: "/org/home" },
    { label: currentSportInfo?.name || sport, href: corporateMode === "inter" ? `/${sport}/org/corporate/inter` : `/${sport}/org/corporate/intra` },
    ...(corporateMode ? [{ label: corporateMode === "intra" ? "Internal" : "External", href: null }] : []),
  ];

  return (
    <div className={cn("flex items-center gap-1 text-sm", className)}>
      {breadcrumb.map((part, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
          {part.href ? (
            <Link
              href={part.href}
              className={cn(
                "text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors",
                index === breadcrumb.length - 1 && cn(primaryTextClass, "font-medium")
              )}
            >
              {part.label}
            </Link>
          ) : (
            <span className={cn(
              "text-gray-600 dark:text-gray-400",
              index === breadcrumb.length - 1 && cn(primaryTextClass, "font-medium")
            )}>
              {part.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
