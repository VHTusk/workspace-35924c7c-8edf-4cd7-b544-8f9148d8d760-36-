"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Trophy,
  Calendar,
  Building2,
  Plus,
  Briefcase,
  UserPlus,
  Mail,
  Settings,
  BarChart3,
  Award,
  Target,
  Shield,
  TrendingUp,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { ThemeToggleCompact } from "@/components/theme-toggle";

// Types
interface DashboardData {
  organization: {
    id: string;
    name: string;
    type: string;
    planTier: string;
    logoUrl: string | null;
  };
  sport: string;
  employerSports: {
    totalEmployees: number;
    verifiedEmployees: number;
    activeTournaments: number;
    pendingInvitations: number;
    upcomingTournaments: Array<{
      id: string;
      name: string;
      startDate: string;
      status: string;
      prizePool: number;
      maxPlayers: number;
    }>;
  };
  competitiveRepresentation: {
    totalSquads: number;
    totalRepPlayers: number;
    contractPlayers: number;
    activeRegistrations: number;
    squads: Array<{
      id: string;
      name: string;
      description: string | null;
      formedAt: string;
      wins: number;
      losses: number;
      _count: {
        players: number;
      };
    }>;
  };
}

// Demo organization ID (in production, this would come from auth)
const DEMO_ORG_ID = "demo-org-001";

export default function CorporateModeDashboard() {
  const [sport, setSport] = useState<"CORNHOLE" | "DARTS">("CORNHOLE");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, [sport]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/orgs/${DEMO_ORG_ID}/corporate-dashboard?sport=${sport}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard");
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      // Use demo data for preview
      setData(getDemoData(sport));
    } finally {
      setLoading(false);
    }
  };

  const getDemoData = (sportType: "CORNHOLE" | "DARTS"): DashboardData => ({
    organization: {
      id: DEMO_ORG_ID,
      name: "TechCorp Industries",
      type: "CORPORATE",
      planTier: "ENTERPRISE",
      logoUrl: null,
    },
    sport: sportType,
    employerSports: {
      totalEmployees: 248,
      verifiedEmployees: 186,
      activeTournaments: 3,
      pendingInvitations: 42,
      upcomingTournaments: [
        {
          id: "t1",
          name: "Q1 2024 Championship",
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "REGISTRATION_OPEN",
          prizePool: 50000,
          maxPlayers: 64,
        },
        {
          id: "t2",
          name: "Department League",
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: "DRAFT",
          prizePool: 25000,
          maxPlayers: 32,
        },
      ],
    },
    competitiveRepresentation: {
      totalSquads: 4,
      totalRepPlayers: 18,
      contractPlayers: 6,
      activeRegistrations: 2,
      squads: [
        {
          id: "s1",
          name: "TechCorp Pro Team",
          description: "Elite competitive squad for state and national tournaments",
          formedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          wins: 24,
          losses: 8,
          _count: { players: 8 },
        },
        {
          id: "s2",
          name: "TechCorp Rising Stars",
          description: "Development squad for emerging talent",
          formedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          wins: 12,
          losses: 6,
          _count: { players: 6 },
        },
      ],
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading Corporate Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="VALORHIVE" className="h-8 w-auto" />
              <span className="text-lg font-bold text-foreground">VALORHIVE</span>
            </Link>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden items-center gap-2 sm:flex">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{data?.organization.name}</span>
              <Badge variant="outline" className="text-xs">
                {data?.organization.planTier}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={sport}
              onValueChange={(v) => setSport(v as "CORNHOLE" | "DARTS")}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                <SelectItem value="DARTS">Darts</SelectItem>
              </SelectContent>
            </Select>
            <ThemeToggleCompact />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Page Title */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Corporate Sports Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your organization&apos;s sports programs
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Quick Action
              </Button>
            </div>
          </div>

          {/* Two-Panel Tabs */}
          <Tabs defaultValue="employer-sports" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="employer-sports" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Employer Sports
              </TabsTrigger>
              <TabsTrigger value="competitive-rep" className="gap-2">
                <Shield className="h-4 w-4" />
                Competitive Representation
              </TabsTrigger>
            </TabsList>

            {/* Layer 1: Employer Sports */}
            <TabsContent value="employer-sports" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.employerSports.totalEmployees}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total Employees
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <UserCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.employerSports.verifiedEmployees}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Verified
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                        <Trophy className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.employerSports.activeTournaments}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Active Tournaments
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.employerSports.pendingInvitations}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pending Invites
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions Row */}
              <div className="flex flex-wrap gap-3">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Internal Tournament
                </Button>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Employees
                </Button>
                <Button variant="outline">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitations
                </Button>
              </div>

              {/* Upcoming Tournaments */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Upcoming Tournaments</CardTitle>
                    <Button variant="ghost" size="sm">
                      View All
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data?.employerSports.upcomingTournaments.map((tournament) => (
                      <div
                        key={tournament.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tournament.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tournament.startDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ₹{tournament.prizePool.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tournament.maxPlayers} players
                            </p>
                          </div>
                          <Badge
                            variant={
                              tournament.status === "REGISTRATION_OPEN"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {tournament.status === "REGISTRATION_OPEN"
                              ? "Open"
                              : "Draft"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {(!data?.employerSports.upcomingTournaments ||
                      data.employerSports.upcomingTournaments.length === 0) && (
                      <div className="py-8 text-center text-muted-foreground">
                        <Trophy className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>No upcoming tournaments</p>
                        <p className="text-xs">Create one to get started</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Employee Roster Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Employee Roster</CardTitle>
                    <Button variant="ghost" size="sm">
                      Manage
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { name: "Engineering", count: 86, color: "bg-teal-500" },
                      { name: "Sales", count: 45, color: "bg-amber-500" },
                      { name: "Marketing", count: 32, color: "bg-purple-500" },
                      { name: "Operations", count: 28, color: "bg-green-500" },
                      { name: "HR", count: 18, color: "bg-rose-500" },
                      { name: "Finance", count: 39, color: "bg-blue-500" },
                    ].map((dept) => (
                      <div
                        key={dept.name}
                        className="flex items-center gap-3 rounded-lg border border-border p-3"
                      >
                        <div className={`h-2 w-2 rounded-full ${dept.color}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{dept.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {dept.count} employees
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Layer 2: Competitive Representation */}
            <TabsContent value="competitive-rep" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                        <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.competitiveRepresentation.totalSquads}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Active Squads
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.competitiveRepresentation.totalRepPlayers}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rep Players
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.competitiveRepresentation.contractPlayers}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Contract Players
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {data?.competitiveRepresentation.activeRegistrations}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Active Registrations
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions Row */}
              <div className="flex flex-wrap gap-3">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Squad
                </Button>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign Contract Player
                </Button>
                <Button variant="outline">
                  <Trophy className="mr-2 h-4 w-4" />
                  Register for Tournament
                </Button>
              </div>

              {/* Squad Cards */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data?.competitiveRepresentation.squads.map((squad) => (
                  <Card key={squad.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{squad.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {squad.description}
                          </p>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-lg font-bold">{squad._count.players}</p>
                          <p className="text-xs text-muted-foreground">Players</p>
                        </div>
                        <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {squad.wins}
                          </p>
                          <p className="text-xs text-muted-foreground">Wins</p>
                        </div>
                        <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">
                            {squad.losses}
                          </p>
                          <p className="text-xs text-muted-foreground">Losses</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Formed{" "}
                          {new Date(squad.formedAt).toLocaleDateString()}
                        </p>
                        <Button variant="ghost" size="sm">
                          Manage Squad
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Inter-Org Tournaments Available */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Available Inter-Org Tournaments
                    </CardTitle>
                    <Button variant="ghost" size="sm">
                      View All
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        name: "State Championship 2024",
                        date: "Mar 15-17, 2024",
                        prize: "₹5,00,000",
                        teams: "32 teams",
                      },
                      {
                        name: "Corporate League Season 2",
                        date: "Apr 1 - May 30, 2024",
                        prize: "₹10,00,000",
                        teams: "64 teams",
                      },
                      {
                        name: "National Invitational",
                        date: "May 10-12, 2024",
                        prize: "₹15,00,000",
                        teams: "16 teams",
                      },
                    ].map((tournament, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <TrendingUp className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tournament.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tournament.date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{tournament.prize}</p>
                            <p className="text-xs text-muted-foreground">
                              {tournament.teams}
                            </p>
                          </div>
                          <Button size="sm">Register</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="VALORHIVE" className="h-6 w-auto" />
              <span className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} VALORHIVE
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/help" className="hover:text-foreground">
                Help
              </Link>
              <Link href="/legal/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/legal/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
