"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserCheck,
  Trophy,
  Calendar,
  AlertCircle,
  ArrowRight,
  Plus,
  Loader2,
  Building2,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  isVerified: boolean;
}

interface IntraTournament {
  id: string;
  name: string;
  startDate: string;
  status: string;
  currentParticipants: number;
  maxParticipants: number;
}

interface IntraDashboardData {
  totalEmployees: number;
  verifiedEmployees: number;
  activeTournaments: number;
  pendingInvitations: number;
  upcomingTournaments: IntraTournament[];
  recentEmployees: Employee[];
}

interface IntraCorporateDashboardProps {
  orgId: string;
}

export function IntraCorporateDashboard({ orgId }: IntraCorporateDashboardProps) {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IntraDashboardData | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchDashboardData();
  }, [orgId, sport]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${orgId}/corporate-dashboard?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const result = await response.json();
        setData({
          totalEmployees: result.employerSports?.totalEmployees || 0,
          verifiedEmployees: result.employerSports?.verifiedEmployees || 0,
          activeTournaments: result.employerSports?.activeTournaments || 0,
          pendingInvitations: result.employerSports?.pendingInvitations || 0,
          upcomingTournaments: result.employerSports?.upcomingTournaments || [],
          recentEmployees: [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch intra dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Failed to load dashboard data</p>
      </div>
    );
  }

  const verificationRate = data.totalEmployees > 0 
    ? Math.round((data.verifiedEmployees / data.totalEmployees) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                <Users className={cn("w-5 h-5", primaryTextClass)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalEmployees}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.verifiedEmployees}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.activeTournaments}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Tournaments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.pendingInvitations}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pending Invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Progress */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900 dark:text-white">Employee Verification Status</CardTitle>
          <CardDescription>Track your employee verification progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Verification Rate</span>
              <span className="font-medium text-gray-900 dark:text-white">{verificationRate}%</span>
            </div>
            <Progress value={verificationRate} className="h-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {data.verifiedEmployees} of {data.totalEmployees} employees verified
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Quick Actions</CardTitle>
          <CardDescription>Manage your Internal activities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className={cn("w-full text-white", primaryBtnClass)}
            onClick={() => router.push(`/${sport}/org/corporate/intra/employees`)}
          >
            <Users className="w-4 h-4 mr-2" />
            Manage Employees
            <ArrowRight className="w-4 h-4 ml-auto" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => router.push(`/${sport}/org/corporate/intra/tournaments`)}
          >
            <span className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Internal Tournaments
            </span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => router.push(`/${sport}/org/corporate/intra/leaderboard`)}
          >
            <span className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Leaderboard
            </span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming Tournaments */}
      <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-gray-900 dark:text-white">Upcoming Internal Tournaments</CardTitle>
            <CardDescription>Internal tournaments for your employees</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/${sport}/org/corporate/intra/tournaments`)}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {data.upcomingTournaments.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming tournaments</p>
              <Button
                variant="link"
                className={cn("mt-2", primaryTextClass)}
                onClick={() => router.push(`/${sport}/org/corporate/intra/tournaments`)}
              >
                Create your first tournament
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcomingTournaments.slice(0, 3).map((tournament) => (
                <div
                  key={tournament.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                      <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{tournament.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(tournament.startDate).toLocaleDateString()} • {tournament.currentParticipants}/{tournament.maxParticipants} participants
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{tournament.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Alert */}
      {data.pendingInvitations > 0 && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Pending Invitations</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  You have {data.pendingInvitations} pending tournament invitation(s) for employees
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => router.push(`/${sport}/org/corporate/intra/tournaments`)}
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
