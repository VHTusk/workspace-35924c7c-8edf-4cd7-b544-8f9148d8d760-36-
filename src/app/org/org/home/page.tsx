"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OrgSidebar from "@/components/layout/org-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  CreditCard,
  Users,
  Trophy,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Eye,
  Zap,
  Lock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Sport configurations
const SPORT_CONFIGS = [
  { id: "CORNHOLE", name: "Cornhole", icon: "🎯", color: "bg-green-500", description: "Bag toss competition" },
  { id: "DARTS", name: "Darts", icon: "🎯", color: "bg-teal-500", description: "Precision throwing" },
  { id: "BADMINTON", name: "Badminton", icon: "🏸", color: "bg-blue-500", description: "Racquet sport" },
  { id: "CRICKET", name: "Cricket", icon: "🏏", color: "bg-orange-500", description: "Bat and ball game" },
  { id: "FOOTBALL", name: "Football", icon: "⚽", color: "bg-emerald-500", description: "The beautiful game" },
  { id: "TABLE_TENNIS", name: "Table Tennis", icon: "🏓", color: "bg-purple-500", description: "Ping pong" },
];

// Fixed pricing: ₹50,000 per sport per year
const PRICE_PER_SPORT = 50000;

interface OrgData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: string;
  city?: string;
  state?: string;
  totalMembers: number;
  tournamentsHosted: number;
  activeSports: number;
}

interface SportSubscription {
  sport: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  planType?: string;
  startDate?: string;
  endDate?: string;
}

export default function OrgHomePage() {
  const router = useRouter();
  const [org, setOrg] = useState<OrgData | null>(null);
  // Demo: Pre-populated subscriptions for testing
  const [sportSubscriptions, setSportSubscriptions] = useState<SportSubscription[]>([
    {
      sport: "CORNHOLE",
      status: "ACTIVE",
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      sport: "DARTS",
      status: "ACTIVE",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgData();
  }, []);

  const fetchOrgData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/org/me", {
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/org/login");
          return;
        }
        throw new Error("Failed to fetch organization data");
      }
      
      const data = await response.json();
      setOrg({
        id: data.id,
        name: data.name || "Organization",
        email: data.email || "",
        phone: data.phone,
        type: data.type || "CORPORATE",
        city: data.city,
        state: data.state,
        totalMembers: data.totalMembers || 0,
        tournamentsHosted: data.tournamentsHosted || 0,
        activeSports: data.activeSports || 0,
      });
      
      // Fetch sport subscriptions
      if (data.id) {
        const sportsResponse = await fetch(`/api/orgs/${data.id}/sports`, {
          credentials: "include",
        });
        if (sportsResponse.ok) {
          const sportsData = await sportsResponse.json();
          // For demo: Only update if API returns ACTIVE subscriptions
          // If all sports are INACTIVE, keep the demo subscriptions for testing
          const hasActiveSubscriptions = sportsData.sports?.some(
            (s: { status: string }) => s.status === "ACTIVE"
          );
          if (hasActiveSubscriptions) {
            // Transform API response to match expected format (id -> sport, uppercase)
            const transformedSports = sportsData.sports.map((s: { id: string; status: string; activatedAt?: string; expiresAt?: string }) => ({
              sport: s.id.toUpperCase(),
              status: s.status,
              startDate: s.activatedAt,
              endDate: s.expiresAt,
            }));
            setSportSubscriptions(transformedSports);
          }
          // Otherwise keep the demo subscriptions already set in state
        }
      }
    } catch (err) {
      console.error("Failed to fetch org data:", err);
      setError("Failed to load organization data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSportSubscription = (sportId: string) => {
    return sportSubscriptions.find(s => s.sport === sportId || s.sport === sportId.toUpperCase());
  };

  const isSportSubscribed = (sportId: string) => {
    const sub = getSportSubscription(sportId);
    return sub?.status === "ACTIVE";
  };

  const handlePreview = (sportId: string) => {
    const lowerSportId = sportId.toLowerCase();
    router.push(`/${lowerSportId}/org/preview`);
  };

  const handleSubscribe = (sportId: string) => {
    const lowerSportId = sportId.toLowerCase();
    router.push(`/org/subscription?sport=${lowerSportId}`);
  };

  const handleEnterWorkspace = (sportId: string) => {
    const lowerSportId = sportId.toLowerCase();
    // Navigate to sport workspace - corporate goes to intra by default
    if (org?.type === "CORPORATE") {
      router.push(`/${lowerSportId}/org/corporate/intra`);
    } else if (org?.type === "SCHOOL") {
      router.push(`/${lowerSportId}/org/school-sports`);
    } else if (org?.type === "COLLEGE") {
      router.push(`/${lowerSportId}/org/college-sports`);
    } else {
      router.push(`/${lowerSportId}/org/dashboard`);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <OrgSidebar />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading organization...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <OrgSidebar />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={fetchOrgData} variant="outline">
                Retry
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const getOrgTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      CORPORATE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      SCHOOL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      COLLEGE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      CLUB: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      ASSOCIATION: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
      ACADEMY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    };
    return colors[type] || colors.CLUB;
  };

  const subscribedCount = sportSubscriptions.filter(s => s.status === "ACTIVE").length;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <OrgSidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 space-y-6 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {org?.name || "Organization"} Home
                </h1>
                {org?.type && (
                  <Badge className={cn("text-xs", getOrgTypeBadge(org.type))}>
                    {org.type}
                  </Badge>
                )}
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Manage your organization and sport subscriptions
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/org/profile")}>
                <Building2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => router.push("/org/subscription")}>
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Subscriptions
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Sports</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {subscribedCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Members</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {org?.totalMembers || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tournaments</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {org?.tournamentsHosted || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Available Sports</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {SPORT_CONFIGS.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sports Grid - Main Section */}
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Sports Workspaces
                  </CardTitle>
                  <CardDescription>
                    Access your subscribed sports or subscribe to new ones
                  </CardDescription>
                </div>
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {subscribedCount} of {SPORT_CONFIGS.length} subscribed
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SPORT_CONFIGS.map((sport) => {
                  const subscription = getSportSubscription(sport.id);
                  const isSubscribed = subscription?.status === "ACTIVE";

                  return (
                    <Card
                      key={sport.id}
                      className={cn(
                        "relative overflow-hidden transition-all",
                        isSubscribed
                          ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
                      )}
                    >
                      {/* Status Badge */}
                      <div className="absolute top-3 right-3">
                        {isSubscribed ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Subscribed
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            <Lock className="w-3 h-3 mr-1" /> Not Subscribed
                          </Badge>
                        )}
                      </div>

                      {/* Sport Header */}
                      <div className="p-4 pb-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl", sport.color)}>
                            {sport.icon}
                          </div>
                          <div className="pr-20">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{sport.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{sport.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Area - Different UI for subscribed vs unsubscribed */}
                      <div className="p-4 pt-0">
                        {isSubscribed ? (
                          // SUBSCRIBED: Show only workspace access, NO preview
                          <div className="space-y-3">
                            {subscription.endDate && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Valid Until</span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {new Date(subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            )}
                            <Button
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleEnterWorkspace(sport.id)}
                            >
                              Enter Workspace
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        ) : (
                          // NOT SUBSCRIBED: Show Preview and Subscribe options
                          <Tabs defaultValue="preview" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-9">
                              <TabsTrigger value="preview" className="text-xs">
                                <Eye className="w-3 h-3 mr-1" /> Preview
                              </TabsTrigger>
                              <TabsTrigger value="subscribe" className="text-xs">
                                <Zap className="w-3 h-3 mr-1" /> Subscribe
                              </TabsTrigger>
                            </TabsList>

                            {/* Preview Tab */}
                            <TabsContent value="preview" className="mt-3">
                              <div className="space-y-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Preview {sport.name} tournaments, leaderboards, and features without subscribing.
                                </p>
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => handlePreview(sport.id)}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Preview {sport.name}
                                </Button>
                              </div>
                            </TabsContent>

                            {/* Subscribe Tab */}
                            <TabsContent value="subscribe" className="mt-3">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                                  <Lock className="w-4 h-4 text-amber-600" />
                                  <p className="text-xs text-amber-700 dark:text-amber-300">
                                    Subscribe to access all {sport.name} features
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="text-gray-500 dark:text-gray-400">Price</span>
                                  <span className="font-semibold text-gray-900 dark:text-white">₹{PRICE_PER_SPORT.toLocaleString()}/year</span>
                                </div>
                                <Button
                                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                  onClick={() => handleSubscribe(sport.id)}
                                >
                                  <Zap className="w-4 h-4 mr-2" />
                                  Subscribe Now
                                </Button>
                              </div>
                            </TabsContent>
                          </Tabs>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => router.push("/org/subscription")}
                >
                  <CreditCard className="w-6 h-6" />
                  <span>Manage Subscriptions</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => router.push("/org/profile")}
                >
                  <Building2 className="w-6 h-6" />
                  <span>Update Profile</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => router.push("/org/settings")}
                >
                  <Building2 className="w-6 h-6" />
                  <span>Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
