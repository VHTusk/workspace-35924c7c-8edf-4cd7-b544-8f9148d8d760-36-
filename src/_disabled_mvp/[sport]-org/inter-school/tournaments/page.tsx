"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import {
  Trophy,
  Calendar,
  MapPin,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Home,
  Shield,
  Award,
  LayoutDashboard,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tournament interface
interface Tournament {
  id: string;
  name: string;
  type: string;
  scope: string;
  status: string;
  location: string;
  city?: string;
  state?: string;
  startDate: string;
  endDate: string;
  regDeadline: string;
  entryFee: number;
  earlyBirdFee?: number;
  earlyBirdDeadline?: string;
  maxPlayers: number;
  registeredPlayers: number;
  prizePool: number;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
}

// Organization interface
interface Organization {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  planTier: string;
}

export default function InterSchoolTournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTab, setActiveTab] = useState("can-participate");

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  useEffect(() => {
    fetchInitialData();
  }, [sport]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError("");
    try {
      // First get org info
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();
      setOrganization(orgData);

      // Check if this is a SCHOOL organization
      if (orgData.type !== "SCHOOL") {
        // Redirect to org home for sport selection
        router.push("/org/home");
        return;
      }

      // Fetch inter-school tournaments
      await fetchTournaments();
    } catch (err) {
      console.error("Initial fetch error:", err);
      setError("Failed to load page data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      // Fetch tournaments with different statuses based on scope
      const response = await fetch(
        `/api/tournaments?sport=${sport.toUpperCase()}&scope=INTER_SCHOOL`
      );
      if (response.ok) {
        const data = await response.json();
        setTournaments(data.tournaments || []);
      }
    } catch (err) {
      console.error("Error fetching tournaments:", err);
    }
  };

  // Filter tournaments by tab
  const getFilteredTournaments = (tab: string) => {
    switch (tab) {
      case "can-participate":
        return tournaments.filter(t => t.status === "REGISTRATION_OPEN");
      case "participating":
        return tournaments.filter(t => 
          t.status === "IN_PROGRESS" || t.status === "REGISTRATION_CLOSED"
        );
      case "participated":
        return tournaments.filter(t => t.status === "COMPLETED");
      default:
        return [];
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start.toDateString() === end.toDateString()) {
      return formatDate(startDate);
    }
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REGISTRATION_OPEN":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Registration Open</Badge>;
      case "REGISTRATION_CLOSED":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Registration Closed</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>;
      case "COMPLETED":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Completed</Badge>;
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Calculate days until deadline
  const getDaysUntilDeadline = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error && !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={fetchInitialData} variant="outline" className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  const filteredTournaments = getFilteredTournaments(activeTab);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Horizontal Navbar */}
          <div className="mb-6">
            <nav className="flex items-center gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
              <Link
                href={`/${sport}/org/school-dashboard`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "text-gray-600 hover:bg-gray-100"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                href={`/${sport}/org/school-teams`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Shield className="w-4 h-4" />
                School Teams
              </Link>
              <Link
                href={`/${sport}/org/inter-school/tournaments`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  primaryBgClass,
                  primaryTextClass
                )}
              >
                <Trophy className="w-4 h-4" />
                Tournaments
              </Link>
              <Link
                href={`/${sport}/org/leaderboard`}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Award className="w-4 h-4" />
                Leaderboard
              </Link>
            </nav>
          </div>

          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inter-School Tournaments</h1>
                <p className="text-gray-500 mt-1">
                  Browse and register your school teams for inter-school competitions
                </p>
              </div>
              <div className="flex items-center gap-2">
                {organization && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {organization.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <Card className={cn("mb-6 border", primaryBorderClass, primaryBgClass)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                  <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Inter-School Competitions</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Register your school teams to compete against other schools. Teams must be formed from your roster before registration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl mb-6">
              <TabsTrigger
                value="can-participate"
                className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Can Participate
                <Badge className="ml-2 bg-green-100 text-green-700" variant="secondary">
                  {getFilteredTournaments("can-participate").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="participating"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
              >
                <Users className="w-4 h-4 mr-2" />
                Participating
                <Badge className="ml-2 bg-blue-100 text-blue-700" variant="secondary">
                  {getFilteredTournaments("participating").length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="participated"
                className="data-[state=active]:bg-gray-100 data-[state=active]:text-gray-700"
              >
                <Award className="w-4 h-4 mr-2" />
                Participated
                <Badge className="ml-2 bg-gray-100 text-gray-700" variant="secondary">
                  {getFilteredTournaments("participated").length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Can Participate Tab */}
            <TabsContent value="can-participate">
              {filteredTournaments.length === 0 ? (
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-12 text-center">
                    <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="font-semibold text-gray-900 mb-2">No Open Tournaments</h3>
                    <p className="text-gray-500 text-sm">
                      There are no inter-school tournaments open for registration at the moment.
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                      Check back later or contact your administrator for upcoming events.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTournaments.map((tournament) => {
                    const daysUntilDeadline = getDaysUntilDeadline(tournament.regDeadline);
                    const isUrgent = daysUntilDeadline <= 3 && daysUntilDeadline > 0;
                    const spotsLeft = tournament.maxPlayers - tournament.registeredPlayers;

                    return (
                      <Card
                        key={tournament.id}
                        className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{tournament.name}</CardTitle>
                              <CardDescription className="mt-1">
                                Inter-School Tournament
                              </CardDescription>
                            </div>
                            {getStatusBadge(tournament.status)}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Date & Location */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{formatDateRange(tournament.startDate, tournament.endDate)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span>{tournament.location}{tournament.city ? `, ${tournament.city}` : ''}</span>
                            </div>
                          </div>

                          {/* Entry Fee */}
                          <div className="flex items-center justify-between py-2 border-t border-gray-100">
                            <span className="text-sm text-gray-500">Entry Fee</span>
                            <span className="font-semibold text-gray-900">
                              {tournament.entryFee > 0 ? `₹${tournament.entryFee}` : "Free"}
                            </span>
                          </div>

                          {/* Registration Deadline */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Registration Deadline</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">
                                {formatDate(tournament.regDeadline)}
                              </span>
                              {isUrgent && (
                                <Badge className="bg-red-100 text-red-700 text-xs">
                                  {daysUntilDeadline} day{daysUntilDeadline !== 1 ? 's' : ''} left
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Spots Available */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Spots Available</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    spotsLeft <= 5 ? "bg-red-500" : spotsLeft <= 10 ? "bg-amber-500" : "bg-green-500"
                                  )}
                                  style={{ width: `${(tournament.registeredPlayers / tournament.maxPlayers) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-gray-700">
                                {spotsLeft} left
                              </span>
                            </div>
                          </div>

                          {/* Age/Gender Info */}
                          {(tournament.ageMin || tournament.ageMax || tournament.gender) && (
                            <div className="flex flex-wrap gap-2">
                              {tournament.ageMin && tournament.ageMax && (
                                <Badge variant="outline" className="text-xs">
                                  Age: {tournament.ageMin}-{tournament.ageMax}
                                </Badge>
                              )}
                              {tournament.gender && tournament.gender !== "ALL" && (
                                <Badge variant="outline" className="text-xs">
                                  {tournament.gender}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Action Button */}
                          <Link href={`/${sport}/tournaments/${tournament.id}`} className="block">
                            <Button className={cn("w-full", primaryBtnClass)}>
                              <Trophy className="w-4 h-4 mr-2" />
                              View & Register
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Participating Tab */}
            <TabsContent value="participating">
              {filteredTournaments.length === 0 ? (
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="font-semibold text-gray-900 mb-2">No Active Participations</h3>
                    <p className="text-gray-500 text-sm">
                      Your school is not currently participating in any inter-school tournaments.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setActiveTab("can-participate")}
                    >
                      Browse Available Tournaments
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTournaments.map((tournament) => (
                    <Card
                      key={tournament.id}
                      className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{tournament.name}</CardTitle>
                            <CardDescription className="mt-1">
                              Inter-School Tournament
                            </CardDescription>
                          </div>
                          {getStatusBadge(tournament.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{formatDateRange(tournament.startDate, tournament.endDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{tournament.location}{tournament.city ? `, ${tournament.city}` : ''}</span>
                          </div>
                        </div>

                        <Link href={`/${sport}/tournaments/${tournament.id}`} className="block">
                          <Button variant="outline" className="w-full">
                            View Details
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Participated Tab */}
            <TabsContent value="participated">
              {filteredTournaments.length === 0 ? (
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-12 text-center">
                    <Award className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="font-semibold text-gray-900 mb-2">No Past Participations</h3>
                    <p className="text-gray-500 text-sm">
                      Your school hasn't participated in any completed inter-school tournaments yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTournaments.map((tournament) => (
                    <Card
                      key={tournament.id}
                      className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{tournament.name}</CardTitle>
                            <CardDescription className="mt-1">
                              Completed on {formatDate(tournament.endDate)}
                            </CardDescription>
                          </div>
                          {getStatusBadge(tournament.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{tournament.location}{tournament.city ? `, ${tournament.city}` : ''}</span>
                          </div>
                        </div>

                        <Link href={`/${sport}/tournaments/${tournament.id}`} className="block">
                          <Button variant="outline" className="w-full">
                            View Results
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Quick Links */}
          <div className="mt-8">
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                      <Shield className={cn("w-5 h-5", primaryTextClass)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Need to create a school team?</h3>
                      <p className="text-sm text-gray-500">
                        Form teams from your student roster before registering for tournaments
                      </p>
                    </div>
                  </div>
                  <Link href={`/${sport}/org/school-teams`}>
                    <Button variant="outline" className="gap-2">
                      Manage School Teams
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
