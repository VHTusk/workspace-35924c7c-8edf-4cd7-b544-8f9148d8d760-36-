"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  Lock,
  Check,
  Zap,
  Building2,
  Shield,
  ArrowRight,
  Loader2,
  Star,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SportPreviewPageProps {
  sport: string;
  orgId: string;
  orgName: string;
}

interface PublicData {
  upcomingTournaments: Array<{
    id: string;
    name: string;
    startDate: string;
    city?: string;
    state?: string;
    maxParticipants: number;
    currentParticipants: number;
    prizePool?: number;
  }>;
  topOrganizations: Array<{
    id: string;
    name: string;
    wins: number;
    tournaments: number;
  }>;
  liveTournaments: number;
  totalParticipants: number;
}

const SPORT_CONFIGS: Record<string, { name: string; icon: string; color: string }> = {
  cornhole: { name: "Cornhole", icon: "🎯", color: "bg-green-500" },
  darts: { name: "Darts", icon: "🎯", color: "bg-teal-500" },
  badminton: { name: "Badminton", icon: "🏸", color: "bg-blue-500" },
  cricket: { name: "Cricket", icon: "🏏", color: "bg-orange-500" },
  football: { name: "Football", icon: "⚽", color: "bg-emerald-500" },
  "table-tennis": { name: "Table Tennis", icon: "🏓", color: "bg-purple-500" },
};

const PLAN_FEATURES = [
  { feature: "Create Internal tournaments", basic: true, pro: true, enterprise: true },
  { feature: "Manage employees", basic: true, pro: true, enterprise: true },
  { feature: "Internal leaderboard", basic: true, pro: true, enterprise: true },
  { feature: "Create External squads", basic: false, pro: true, enterprise: true },
  { feature: "Player contracts", basic: false, pro: true, enterprise: true },
  { feature: "Register for inter-org tournaments", basic: false, pro: true, enterprise: true },
  { feature: "Advanced analytics", basic: false, pro: true, enterprise: true },
  { feature: "Priority support", basic: false, pro: false, enterprise: true },
  { feature: "Custom integrations", basic: false, pro: false, enterprise: true },
];

export function SportPreviewPage({ sport, orgId, orgName }: SportPreviewPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [publicData, setPublicData] = useState<PublicData | null>(null);

  const config = SPORT_CONFIGS[sport] || { name: sport, icon: "🏆", color: "bg-gray-500" };
  const isCornhole = sport === "cornhole";

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30";

  useEffect(() => {
    fetchPublicData();
  }, [sport]);

  const fetchPublicData = async () => {
    setLoading(true);
    try {
      // Fetch public tournament data (no auth required for preview)
      const response = await fetch(`/api/public/sport-preview?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setPublicData(data);
      } else {
        // Set demo data for preview
        setPublicData({
          upcomingTournaments: [
            { id: "1", name: "Corporate Championship 2026", startDate: "2026-04-15", city: "Mumbai", state: "Maharashtra", maxParticipants: 64, currentParticipants: 32, prizePool: 100000 },
            { id: "2", name: "Inter-Company League", startDate: "2026-05-01", city: "Delhi", state: "Delhi", maxParticipants: 32, currentParticipants: 18, prizePool: 50000 },
          ],
          topOrganizations: [
            { id: "1", name: "TechCorp India", wins: 12, tournaments: 8 },
            { id: "2", name: "Global Solutions Ltd", wins: 10, tournaments: 7 },
            { id: "3", name: "Innovation Labs", wins: 8, tournaments: 6 },
          ],
          liveTournaments: 2,
          totalParticipants: 1247,
        });
      }
    } catch (error) {
      console.error("Failed to fetch public data:", error);
      setPublicData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = () => {
    router.push(`/${sport}/org/subscription?activate=true`);
  };

  const handleGoBack = () => {
    router.push(`/${sport}/org/home`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Banner */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Lock className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                Preview Mode - {config.name}
              </h2>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                You're viewing a read-only preview of {config.name}. Subscribe to unlock full access to Internal and External features.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Button className={cn("text-white", primaryClass)} onClick={handleSubscribe}>
                  <Zap className="w-4 h-4 mr-2" />
                  Subscribe to {config.name}
                </Button>
                <Button variant="outline" onClick={handleGoBack}>
                  Back to Dashboard
                </Button>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
                Want to subscribe to multiple sports?{" "}
                <button
                  onClick={() => router.push(`/${sport}/org/subscription`)}
                  className="underline hover:no-underline font-medium"
                >
                  Manage all subscriptions
                </button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sport Header */}
      <div className="flex items-center gap-4">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl", config.color)}>
          {config.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{config.name}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Preview the corporate sports platform for {config.name}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4 text-center">
            <Trophy className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{publicData?.liveTournaments || 0}</p>
            <p className="text-xs text-gray-500">Live Tournaments</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{publicData?.upcomingTournaments?.length || 0}</p>
            <p className="text-xs text-gray-500">Upcoming Events</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{publicData?.totalParticipants?.toLocaleString() || "0"}</p>
            <p className="text-xs text-gray-500">Total Participants</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{publicData?.topOrganizations?.length || 0}</p>
            <p className="text-xs text-gray-500">Active Organizations</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Tournaments */}
        <div className="lg:col-span-2">
          <Card className="bg-white dark:bg-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming {config.name} Tournaments
              </CardTitle>
              <CardDescription>Public tournaments open for registration</CardDescription>
            </CardHeader>
            <CardContent>
              {publicData?.upcomingTournaments && publicData.upcomingTournaments.length > 0 ? (
                <div className="space-y-3">
                  {publicData.upcomingTournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                          <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{tournament.name}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {new Date(tournament.startDate).toLocaleDateString()}
                            {tournament.city && (
                              <>
                                <span>•</span>
                                <MapPin className="w-3 h-3" />
                                {tournament.city}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {tournament.currentParticipants}/{tournament.maxParticipants} slots
                        </Badge>
                        {tournament.prizePool && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            ₹{tournament.prizePool.toLocaleString()} prize
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming tournaments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Organizations */}
        <div>
          <Card className="bg-white dark:bg-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Organizations
              </CardTitle>
              <CardDescription>Leading companies in {config.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {publicData?.topOrganizations && publicData.topOrganizations.length > 0 ? (
                <div className="space-y-3">
                  {publicData.topOrganizations.map((org, index) => (
                    <div
                      key={org.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-200 text-gray-700" :
                        index === 2 ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{org.name}</p>
                        <p className="text-xs text-gray-500">{org.wins} wins • {org.tournaments} tournaments</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No ranking data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* What You Get */}
      <Card className="bg-white dark:bg-gray-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className={cn("w-5 h-5", primaryTextClass)} />
            What You Get with a Subscription
          </CardTitle>
          <CardDescription>Full access to Internal and External corporate features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Feature</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Rookie</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Pro</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Elite</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((item, i) => (
                  <tr key={i} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{item.feature}</td>
                    <td className="text-center py-3 px-4">
                      {item.basic ? <Check className={cn("w-5 h-5 mx-auto", primaryTextClass)} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.pro ? <Check className={cn("w-5 h-5 mx-auto", primaryTextClass)} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-center py-3 px-4">
                      {item.enterprise ? <Check className={cn("w-5 h-5 mx-auto", primaryTextClass)} /> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-center">
            <Button className={cn("text-white", primaryClass)} onClick={handleSubscribe}>
              Subscribe Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mode Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Internal Mode</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">Within your organization</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Employee management</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Internal tournaments</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Internal leaderboard</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Activity analytics</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">External Mode</h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">Competing with other organizations</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Player contracts</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Rep squads</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> External tournaments</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Performance tracking</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
