"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Settings,
  Loader2,
  Users2,
  Target,
  Medal,
  ArrowRight,
  Trophy,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SportSubscription {
  id: string;
  status: string;
  planType?: string;
  activatedAt?: string;
  expiresAt?: string;
}

const SPORT_CONFIGS: Record<string, { name: string; icon: string; color: string }> = {
  cornhole: { name: "Cornhole", icon: "🎯", color: "bg-green-500" },
  darts: { name: "Darts", icon: "🎯", color: "bg-teal-500" },
  badminton: { name: "Badminton", icon: "🏸", color: "bg-blue-500" },
  cricket: { name: "Cricket", icon: "🏏", color: "bg-orange-500" },
  football: { name: "Football", icon: "⚽", color: "bg-emerald-500" },
  "table-tennis": { name: "Table Tennis", icon: "🏓", color: "bg-purple-500" },
};

export default function InterCorporatePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const sportConfig = SPORT_CONFIGS[sport] || { name: sport, icon: "🏆", color: "bg-gray-500" };
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SportSubscription | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchSubscription();
  }, [sport]);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const orgResponse = await fetch("/api/org/me");
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        if (orgData.id) {
          const sportsResponse = await fetch(`/api/orgs/${orgData.id}/sports`);
          if (sportsResponse.ok) {
            const sportsData = await sportsResponse.json();
            const sportSub = sportsData.sports?.find(
              (s: SportSubscription) => s.id === sport?.toLowerCase()
            );
            setSubscription(sportSub || null);
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <OrganizationLayoutWrapper>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </OrganizationLayoutWrapper>
    );
  }

  return (
    <OrganizationLayoutWrapper>
      {/* Subscription Status Banner */}
      {subscription && subscription.status === "ACTIVE" && (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {sportConfig.name} Subscription Active
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Plan: {subscription.planType || "PRO"}
                    {subscription.expiresAt && (
                      <> • Expires: {new Date(subscription.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/org/subscription")}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rep Squads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                <Users2 className={cn("w-5 h-5", primaryTextClass)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rep Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Contract Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Registrations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm mb-6">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              className={cn("text-white justify-start", primaryBtnClass)}
              onClick={() => router.push(`/${sport}/org/corporate/inter/squads`)}
            >
              <Shield className="w-4 h-4 mr-2" />
              Manage Rep Squads
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push(`/${sport}/org/corporate/inter/tournaments`)}
            >
              <Trophy className="w-4 h-4 mr-2" />
              External Tournaments
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push(`/${sport}/org/corporate/inter/results`)}
            >
              <Medal className="w-4 h-4 mr-2" />
              Results
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sport Settings */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{sportConfig.name} Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push(`/${sport}/org/settings`)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Sport Settings
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => router.push("/org/subscription")}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Manage Subscription
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </OrganizationLayoutWrapper>
  );
}
