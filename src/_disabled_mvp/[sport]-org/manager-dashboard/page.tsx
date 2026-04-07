"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Trophy,
  Calendar,
  ArrowLeft,
  Loader2,
  Building2,
  TrendingUp,
  Award,
  Target,
  CheckCircle,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
  isVerified: boolean;
  tournamentsPlayed: number;
  totalPoints: number;
  wins: number;
  losses: number;
  user?: { id: string } | null;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  managerId: string | null;
  totalEmployees: number;
  activePlayers: number;
  totalPoints: number;
}

export default function ManagerDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState<any[]>([]);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchManagerData();
  }, [sport]);

  const fetchManagerData = async () => {
    setLoading(true);
    try {
      // Demo data - in production, fetch from API
      setDepartment({
        id: "dept-1",
        name: "Engineering",
        code: "ENG",
        managerId: "user-1",
        totalEmployees: 86,
        activePlayers: 42,
        totalPoints: 1240,
      });
      setEmployees(getDemoEmployees());
      setUpcomingTournaments([
        {
          id: "t1",
          name: "Q1 Championship",
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          registrations: 12,
          status: "REGISTRATION_OPEN",
        },
        {
          id: "t2",
          name: "Inter-Department League",
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          registrations: 8,
          status: "REGISTRATION_OPEN",
        },
      ]);
    } catch (err) {
      console.error("Failed to fetch manager data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDemoEmployees = (): Employee[] => [
    {
      id: "1",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@company.com",
      designation: "Senior Developer",
      isVerified: true,
      tournamentsPlayed: 5,
      totalPoints: 42,
      wins: 12,
      losses: 3,
      user: { id: "u1" },
    },
    {
      id: "2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@company.com",
      designation: "Tech Lead",
      isVerified: true,
      tournamentsPlayed: 4,
      totalPoints: 35,
      wins: 10,
      losses: 4,
      user: { id: "u2" },
    },
    {
      id: "3",
      firstName: "Bob",
      lastName: "Wilson",
      email: "bob.wilson@company.com",
      designation: "Developer",
      isVerified: false,
      tournamentsPlayed: 0,
      totalPoints: 0,
      wins: 0,
      losses: 0,
    },
    {
      id: "4",
      firstName: "Alice",
      lastName: "Brown",
      email: "alice.brown@company.com",
      designation: "Junior Developer",
      isVerified: true,
      tournamentsPlayed: 2,
      totalPoints: 15,
      wins: 4,
      losses: 2,
      user: { id: "u4" },
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const participationRate = department
    ? Math.round((department.activePlayers / department.totalEmployees) * 100)
    : 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/employer-sports/departments`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Departments
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {department?.name} Dashboard
                </h1>
                <p className="text-gray-500">
                  Manager View • {sport.toUpperCase()}
                </p>
              </div>
              <Badge variant="outline" className="text-sm">
                <Building2 className="h-3 w-3 mr-1" />
                {department?.code}
              </Badge>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                    <Users className={cn("h-5 w-5", primaryTextClass)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {department?.totalEmployees}
                    </p>
                    <p className="text-xs text-gray-500">Team Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {department?.activePlayers}
                    </p>
                    <p className="text-xs text-gray-500">Active Players</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <Award className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {department?.totalPoints}
                    </p>
                    <p className="text-xs text-gray-500">Total Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{participationRate}%</p>
                    <p className="text-xs text-gray-500">Participation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Members */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Team Members</CardTitle>
                <CardDescription>
                  {employees.filter((e) => e.isVerified).length} verified •{" "}
                  {employees.filter((e) => e.user).length} with player accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>W-L</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {emp.firstName} {emp.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{emp.designation}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{emp.totalPoints}</TableCell>
                          <TableCell>
                            <span className="text-green-600">{emp.wins}</span>
                            <span className="text-gray-400">-</span>
                            <span className="text-red-600">{emp.losses}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {emp.isVerified ? (
                                <Badge
                                  variant="outline"
                                  className="text-green-600 border-green-200 text-xs"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 text-xs">
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Tournaments */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Upcoming Tournaments</CardTitle>
                <CardDescription>
                  Encourage your team to participate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-50">
                          <Trophy className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-500">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {new Date(t.startDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{t.registrations} registered</p>
                        <Button variant="link" size="sm" className="h-auto p-0">
                          <Mail className="h-3 w-3 mr-1" />
                          Invite team
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Participation Progress */}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Department Participation</p>
                    <p className="text-sm text-gray-500">{participationRate}%</p>
                  </div>
                  <Progress value={participationRate} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {department?.activePlayers} of {department?.totalEmployees} employees have played
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
