"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ToggleLeft,
  ToggleRight,
  Search,
  Loader2,
  Shield,
  Users,
  Trophy,
  MessageSquare,
  CreditCard,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SiteFooter from "@/components/layout/site-footer";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy?: string;
}

const defaultFlags: FeatureFlag[] = [
  {
    id: "1",
    key: "enable_tournament_registration",
    name: "Tournament Registration",
    description: "Allow players to register for tournaments",
    category: "Tournaments",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    key: "enable_duel_mode",
    name: "Duel Mode",
    description: "1v1 quick match feature",
    category: "Gameplay",
    enabled: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    key: "enable_social_features",
    name: "Social Features",
    description: "Following, activity feed, friend lists",
    category: "Social",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    key: "enable_chat",
    name: "In-App Chat",
    description: "Messaging between players",
    category: "Communication",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "5",
    key: "enable_push_notifications",
    name: "Push Notifications",
    description: "Browser and mobile push alerts",
    category: "Notifications",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "6",
    key: "enable_premium_tiers",
    name: "Premium Tiers",
    description: "Subscription tiers and benefits",
    category: "Payments",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "7",
    key: "enable_maintenance_mode",
    name: "Maintenance Mode",
    description: "Show maintenance page to users",
    category: "System",
    enabled: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "8",
    key: "enable_beta_features",
    name: "Beta Features",
    description: "Show experimental features to all users",
    category: "System",
    enabled: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "9",
    key: "enable_new_bracket_ui",
    name: "New Bracket UI",
    description: "Redesigned bracket visualization",
    category: "UI",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "10",
    key: "enable_tournament_recommendations",
    name: "Tournament Recommendations",
    description: "AI-powered tournament suggestions",
    category: "Features",
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
];

export default function FeatureFlagsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  useEffect(() => {
    fetchFlags();
  }, [sport]);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/feature-flags");
      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags || defaultFlags);
      } else {
        setFlags(defaultFlags);
      }
    } catch {
      setFlags(defaultFlags);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    setSaving(flag.id);
    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: flag.key,
          enabled: !flag.enabled,
        }),
      });

      if (response.ok) {
        setFlags((prev) =>
          prev.map((f) =>
            f.id === flag.id
              ? { ...f, enabled: !f.enabled, updatedAt: new Date().toISOString() }
              : f
          )
        );
        toast.success(`${flag.name} ${!flag.enabled ? "enabled" : "disabled"}`);
      } else {
        toast.error("Failed to update flag");
      }
    } catch {
      toast.error("Failed to update flag");
    } finally {
      setSaving(null);
    }
  };

  const categories = [...new Set(flags.map((f) => f.category))];

  const filteredFlags = flags.filter((f) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.name.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query)
      );
    }
    if (categoryFilter !== "all") {
      return f.category === categoryFilter;
    }
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Tournaments":
        return Trophy;
      case "Social":
        return Users;
      case "Communication":
        return MessageSquare;
      case "Notifications":
        return Bell;
      case "Payments":
        return CreditCard;
      case "System":
        return Shield;
      case "Settings":
        return Settings;
      default:
        return ToggleLeft;
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <main className="flex-1 md:ml-72 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <ToggleRight className={cn("w-7 h-7", primaryTextClass)} />
              Feature Flags
            </h1>
            <p className="text-muted-foreground">
              Enable or disable platform features dynamically
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-500">
                  {flags.filter((f) => f.enabled).length}
                </p>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">
                  {flags.filter((f) => !f.enabled).length}
                </p>
                <p className="text-xs text-muted-foreground">Disabled</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{flags.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search flags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter("all")}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Flags List */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              filteredFlags.map((flag) => {
                const Icon = getCategoryIcon(flag.category);
                return (
                  <Card
                    key={flag.id}
                    className={cn(
                      "bg-card shadow-sm transition-all",
                      flag.enabled ? "border-green-500/30" : "border-border/50"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              flag.enabled
                                ? isCornhole
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-teal-100 dark:bg-teal-900/30"
                                : "bg-muted"
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-5 h-5",
                                flag.enabled ? primaryTextClass : "text-muted-foreground"
                              )}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{flag.name}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  flag.enabled
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}
                              >
                                {flag.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {flag.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Category: {flag.category}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {saving === flag.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={flag.enabled}
                            onCheckedChange={() => handleToggle(flag)}
                            disabled={saving === flag.id}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Warning */}
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Warning:</strong> Disabling features may affect user experience.
                Changes take effect immediately across the platform.
              </p>
            </CardContent>
          </Card>
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
