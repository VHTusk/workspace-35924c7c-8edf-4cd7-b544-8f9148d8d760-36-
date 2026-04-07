"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Users,
  AlertTriangle,
  Shield,
  Activity,
  TrendingUp,
  User,
  Crown,
  MapPin,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SportType } from "@prisma/client";

// ============================================
// Types
// ============================================

interface AdminInfo {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  role: string;
  sport: SportType | null;
  scope: {
    stateCode: string | null;
    districtName: string | null;
  };
  isActive: boolean;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  trustLevel: number;
  loadPercent?: number;
  activeTournaments?: number;
  maxCapacity?: number;
}

interface HierarchyLevel {
  role: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  activeCount: number;
  inactiveCount: number;
  avgLoadPercent: number;
  admins: AdminInfo[];
}

interface LoadSummary {
  totalAdmins: number;
  availableAdmins: number;
  overloadedAdmins: number;
  avgLoadPercent: number;
  topLoaded: Array<{
    adminId: string;
    currentLoadPercent: number;
  }>;
  topAvailable: Array<{
    adminId: string;
    currentLoadPercent: number;
  }>;
}

interface AdminHierarchyTreeProps {
  sport?: SportType;
  stateCode?: string;
  showInactive?: boolean;
  onAdminClick?: (adminId: string) => void;
}

// ============================================
// Constants
// ============================================

const ADMIN_HIERARCHY = [
  {
    role: "SUPER_ADMIN",
    label: "Super Admin",
    description: "Cross-sport, cross-geography (1-2 people)",
    color: "bg-purple-500",
    borderColor: "border-purple-500",
  },
  {
    role: "SPORT_ADMIN",
    label: "Sport Admin",
    description: "One sport, all geography (1-2 per sport)",
    color: "bg-indigo-500",
    borderColor: "border-indigo-500",
  },
  {
    role: "STATE_ADMIN",
    label: "State Admin",
    description: "One sport, one state",
    color: "bg-teal-500",
    borderColor: "border-teal-500",
  },
  {
    role: "DISTRICT_ADMIN",
    label: "District Admin",
    description: "One sport, one district",
    color: "bg-emerald-500",
    borderColor: "border-emerald-500",
  },
  {
    role: "TOURNAMENT_DIRECTOR",
    label: "Tournament Director",
    description: "Assigned tournaments only",
    color: "bg-amber-500",
    borderColor: "border-amber-500",
  },
];

const ESCALATION_CHAIN = [
  "SUPER_ADMIN",
  "SPORT_ADMIN",
  "STATE_ADMIN",
  "DISTRICT_ADMIN",
  "TOURNAMENT_DIRECTOR",
];

// ============================================
// Helper Functions
// ============================================

function getLoadColor(loadPercent: number): string {
  if (loadPercent < 50) return "text-green-600 bg-green-100";
  if (loadPercent < 70) return "text-yellow-600 bg-yellow-100";
  if (loadPercent < 85) return "text-orange-600 bg-orange-100";
  return "text-red-600 bg-red-100";
}

function getLoadColorHex(loadPercent: number): string {
  if (loadPercent < 50) return "#22c55e"; // green
  if (loadPercent < 70) return "#eab308"; // yellow
  if (loadPercent < 85) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getRoleIcon(role: string): React.ReactNode {
  switch (role) {
    case "SUPER_ADMIN":
      return <Crown className="h-4 w-4" />;
    case "SPORT_ADMIN":
      return <Shield className="h-4 w-4" />;
    case "STATE_ADMIN":
    case "DISTRICT_ADMIN":
      return <Users className="h-4 w-4" />;
    case "TOURNAMENT_DIRECTOR":
      return <Activity className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
}

function getEscalationChain(role: string): string[] {
  const currentIndex = ESCALATION_CHAIN.indexOf(role);
  if (currentIndex === -1 || currentIndex === 0) return [];
  return ESCALATION_CHAIN.slice(0, currentIndex);
}

function formatRoleName(role: string): string {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================
// Component
// ============================================

export function AdminHierarchyTree({
  sport,
  stateCode,
  showInactive = true,
  onAdminClick,
}: AdminHierarchyTreeProps) {
  const [hierarchyData, setHierarchyData] = useState<HierarchyLevel[]>([]);
  const [loadSummary, setLoadSummary] = useState<LoadSummary | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (sport) params.append("sport", sport);
      if (stateCode) params.append("stateCode", stateCode);

      // Fetch assignments
      const assignmentsRes = await fetch(`/api/admin/assignments?${params.toString()}`);
      const assignmentsData = await assignmentsRes.json();

      // Fetch load summary
      const loadParams = new URLSearchParams();
      loadParams.append("action", "load-summary");
      if (sport) loadParams.append("sport", sport);
      if (stateCode) loadParams.append("stateCode", stateCode);

      const loadRes = await fetch(`/api/admin/governance?${loadParams.toString()}`);
      const loadData = await loadRes.json();

      // Fetch individual load metrics for admins
      const metricsParams = new URLSearchParams();
      metricsParams.append("action", "load-metrics");
      if (sport) metricsParams.append("sport", sport);
      if (stateCode) metricsParams.append("stateCode", stateCode);

      const metricsRes = await fetch(`/api/admin/governance?${metricsParams.toString()}`);
      const metricsData = await metricsRes.json();

      // Create a map of admin loads
      const loadMap = new Map<string, { loadPercent: number; activeTournaments: number; maxCapacity: number }>();
      if (metricsData.success && metricsData.metrics) {
        for (const metric of metricsData.metrics) {
          loadMap.set(metric.adminId, {
            loadPercent: metric.currentLoadPercent,
            activeTournaments: metric.activeTournaments,
            maxCapacity: metric.maxCapacity,
          });
        }
      }

      // Process assignments into hierarchy
      const assignments = assignmentsData.assignments || [];
      const hierarchy: HierarchyLevel[] = ADMIN_HIERARCHY.map((level) => {
        const levelAdmins = assignments.filter(
          (a: AdminInfo) => a.role === level.role
        );

        // Filter by showInactive
        const visibleAdmins = showInactive
          ? levelAdmins
          : levelAdmins.filter((a: AdminInfo) => a.isActive);

        // Add load info to admins
        const adminsWithLoad = visibleAdmins.map((admin: AdminInfo) => {
          const loadInfo = loadMap.get(admin.id);
          return {
            ...admin,
            loadPercent: loadInfo?.loadPercent ?? 0,
            activeTournaments: loadInfo?.activeTournaments ?? 0,
            maxCapacity: loadInfo?.maxCapacity ?? 5,
          };
        });

        const activeAdmins = levelAdmins.filter((a: AdminInfo) => a.isActive);
        const inactiveAdmins = levelAdmins.filter((a: AdminInfo) => !a.isActive);

        // Calculate average load
        const avgLoad =
          adminsWithLoad.length > 0
            ? adminsWithLoad.reduce((sum: number, a: AdminInfo) => sum + (a.loadPercent || 0), 0) /
              adminsWithLoad.length
            : 0;

        return {
          role: level.role,
          label: level.label,
          description: level.description,
          icon: getRoleIcon(level.role),
          count: levelAdmins.length,
          activeCount: activeAdmins.length,
          inactiveCount: inactiveAdmins.length,
          avgLoadPercent: Math.round(avgLoad * 10) / 10,
          admins: adminsWithLoad,
        };
      });

      setHierarchyData(hierarchy);
      setLoadSummary(loadData.summary || null);
    } catch (err) {
      console.error("Error fetching hierarchy data:", err);
      setError("Failed to load admin hierarchy");
    } finally {
      setLoading(false);
    }
  }, [sport, stateCode, showInactive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle level expansion
  const toggleLevel = (role: string) => {
    setExpandedLevels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(role)) {
        newSet.delete(role);
      } else {
        newSet.add(role);
      }
      return newSet;
    });
  };

  // Handle admin click
  const handleAdminClick = (adminId: string) => {
    if (onAdminClick) {
      onAdminClick(adminId);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading hierarchy...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <span className="ml-2 text-destructive">{error}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {loadSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{loadSummary.totalAdmins}</p>
                  <p className="text-xs text-muted-foreground">Total Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{loadSummary.availableAdmins}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{loadSummary.overloadedAdmins}</p>
                  <p className="text-xs text-muted-foreground">Overloaded</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{loadSummary.avgLoadPercent}%</p>
                  <p className="text-xs text-muted-foreground">Avg Load</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hierarchy Tree */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Hierarchy
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click on a level to expand and view admins
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-2">
              {hierarchyData.map((level, index) => {
                const levelConfig = ADMIN_HIERARCHY.find(
                  (l) => l.role === level.role
                );
                const isExpanded = expandedLevels.has(level.role);
                const hasAdmins = level.admins.length > 0;

                return (
                  <div key={level.role}>
                    {/* Level Header */}
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => hasAdmins && toggleLevel(level.role)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                            levelConfig?.borderColor || "border-gray-300",
                            isExpanded ? "bg-accent/50" : "hover:bg-accent/30",
                            !hasAdmins && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          {/* Expand Icon */}
                          <div className="flex-shrink-0">
                            {hasAdmins ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )
                            ) : (
                              <div className="w-4 h-4" />
                            )}
                          </div>

                          {/* Level Icon */}
                          <div
                            className={cn(
                              "p-2 rounded-full text-white",
                              levelConfig?.color || "bg-gray-500"
                            )}
                          >
                            {level.icon}
                          </div>

                          {/* Level Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{level.label}</span>
                              <Badge variant="secondary" className="text-xs">
                                {level.activeCount} active
                              </Badge>
                              {level.inactiveCount > 0 && showInactive && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-orange-600 border-orange-300"
                                >
                                  {level.inactiveCount} inactive
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {level.description}
                            </p>
                          </div>

                          {/* Load Indicator */}
                          <div className="flex-shrink-0 text-right">
                            <div
                              className={cn(
                                "px-2 py-1 rounded text-sm font-medium",
                                getLoadColor(level.avgLoadPercent)
                              )}
                            >
                              {level.avgLoadPercent}%
                            </div>
                            <p className="text-xs text-muted-foreground">avg load</p>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      {/* Level Content - Admins List */}
                      <CollapsibleContent>
                        <div className="ml-8 mt-2 space-y-1 border-l-2 border-muted pl-4">
                          {level.admins.map((admin) => (
                            <Tooltip key={admin.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors",
                                    !admin.isActive && "opacity-60"
                                  )}
                                  onClick={() => handleAdminClick(admin.id)}
                                >
                                  {/* Status Indicator */}
                                  <div className="flex-shrink-0 relative">
                                    <div
                                      className={cn(
                                        "w-2 h-2 rounded-full",
                                        admin.isActive
                                          ? "bg-green-500"
                                          : "bg-red-500"
                                      )}
                                    />
                                    {!admin.isActive && (
                                      <AlertTriangle className="h-3 w-3 text-orange-500 absolute -top-1 -right-1" />
                                    )}
                                  </div>

                                  {/* Admin Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">
                                        {admin.user.firstName} {admin.user.lastName}
                                      </span>
                                      {admin.trustLevel > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Trust: {admin.trustLevel}
                                        </Badge>
                                      )}
                                      {!admin.isActive && (
                                        <Badge
                                          variant="destructive"
                                          className="text-xs"
                                        >
                                          Inactive
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {admin.scope.stateCode && (
                                        <span>{admin.scope.stateCode}</span>
                                      )}
                                      {admin.scope.districtName && (
                                        <span> / {admin.scope.districtName}</span>
                                      )}
                                      {admin.sport && (
                                        <span className="ml-1">
                                          ({admin.sport})
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* Load Badge */}
                                  <div className="flex-shrink-0">
                                    <div
                                      className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium",
                                        getLoadColor(admin.loadPercent || 0)
                                      )}
                                    >
                                      {admin.loadPercent ?? 0}%
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                      {admin.activeTournaments ?? 0}/
                                      {admin.maxCapacity ?? 5}
                                    </p>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="max-w-xs"
                              >
                                <div className="space-y-2">
                                  <p className="font-semibold">
                                    Escalation Chain
                                  </p>
                                  <div className="space-y-1">
                                    {getEscalationChain(level.role).map(
                                      (escalationRole, idx) => (
                                        <div
                                          key={escalationRole}
                                          className="flex items-center gap-2 text-xs"
                                        >
                                          <span className="text-muted-foreground">
                                            {idx + 1}.
                                          </span>
                                          <span>
                                            {formatRoleName(escalationRole)}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                  {admin.deactivationReason && (
                                    <p className="text-xs text-orange-500">
                                      Reason: {admin.deactivationReason}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Connector Line */}
                    {index < hierarchyData.length - 1 && (
                      <div className="ml-6 w-0.5 h-4 bg-muted" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Load Legend</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-500" />
              <span className="text-xs text-muted-foreground">
                &lt;50% (Low)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-500" />
              <span className="text-xs text-muted-foreground">
                50-70% (Medium)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-100 border border-orange-500" />
              <span className="text-xs text-muted-foreground">
                70-85% (High)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-500" />
              <span className="text-xs text-muted-foreground">
                &gt;85% (Critical)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminHierarchyTree;
