"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Users,
  Clock,
  IndianRupee,
  Shield,
  LayoutDashboard,
  Award,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Organization {
  id: string;
  name: string;
  type: string;
  email?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
}

interface Tournament {
  id: string;
  name: string;
  description?: string;
  status: string;
  scope: string;
  startDate: string;
  endDate?: string;
  regDeadline: string;
  location?: string;
  city?: string;
  state?: string;
  entryFee?: number;
  earlyBirdFee?: number;
  earlyBirdDeadline?: string;
  maxPlayers?: number;
  prizePool?: number;
  registeredPlayers: number;
  createdAt: string;
  isRegistered?: boolean;
  teamId?: string;
}

interface TournamentData {
  tournaments: Tournament[];
}

export default function InterCollegeTournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);

  // Tournament data for each tab
  const [availableTournaments, setAvailableTournaments] = useState<Tournament[]>([]);
  const [participatingTournaments, setParticipatingTournaments] = useState<Tournament[]>([]);
  const [participatedTournaments, setParticipatedTournaments] = useState<Tournament[]>([]);
  const [activeTab, setActiveTab] = useState("available");

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  useEffect(() => {
    fetchOrgAndTournaments();
  }, [sport]);

  const fetchOrgAndTournaments = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch organization data
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        throw new Error("Failed to fetch organization data");
      }
      const orgData = await orgResponse.json();
      setOrg(orgData);

      // Verify it's a COLLEGE type organization
      if (orgData.type !== "COLLEGE") {
        // Redirect to org home for sport selection
        router.push("/org/home");
        return;
      }

      // Fetch all tournament types in parallel
      const [availableRes, participatingRes, participatedRes] = await Promise.all([
        // Can Participate - REGISTRATION_OPEN tournaments
        fetch(`/api/tournaments?sport=${sport.toUpperCase()}&status=REGISTRATION_OPEN&scope=INTER_COLLEGE`),
        // Participating - IN_PROGRESS tournaments (where college has registered)
        fetch(`/api/tournaments?sport=${sport.toUpperCase()}&status=IN_PROGRESS&scope=INTER_COLLEGE`),
        // Participated - COMPLETED tournaments
        fetch(`/api/tournaments?sport=${sport.toUpperCase()}&status=COMPLETED&scope=INTER_COLLEGE`),
      ]);

      // Parse available tournaments
      if (availableRes.ok) {
        const data: TournamentData = await availableRes.json();
        setAvailableTournaments(data.tournaments || []);
      }

      // Parse participating tournaments
      if (participatingRes.ok) {
        const data: TournamentData = await participatingRes.json();
        setParticipatingTournaments(data.tournaments || []);
      }

      // Parse participated tournaments
      if (participatedRes.ok) {
        const data: TournamentData = await participatedRes.json();
        setParticipatedTournaments(data.tournaments || []);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load tournaments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format short date
  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Get days remaining until deadline
  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get status badge for tournament
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      REGISTRATION_OPEN: "bg-green-100 text-green-700",
      REGISTRATION_CLOSED: "bg-amber-100 text-amber-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      COMPLETED: "bg-purple-100 text-purple-700",
      CANCELLED: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      REGISTRATION_OPEN: "Registration Open",
      REGISTRATION_CLOSED: "Registration Closed",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100 text-gray-700"}>
        {labels[status] || status}
      </Badge>
    );
  };

  // Render tournament card
  const renderTournamentCard = (tournament: Tournament, showRegisterButton: boolean = true) => {
    const daysRemaining = getDaysRemaining(tournament.regDeadline);
    const isUrgent = daysRemaining <= 3 && daysRemaining > 0;
    const isClosed = daysRemaining <= 0;

    return (
      <Card key={tournament.id} className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{tournament.name}</h3>
                {getStatusBadge(tournament.status)}
              </div>
              {tournament.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{tournament.description}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>{formatShortDate(tournament.startDate)}</span>
              {tournament.endDate && (
                <span className="text-gray-400">- {formatShortDate(tournament.endDate)}</span>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="truncate">
                {tournament.location || tournament.city || "TBD"}
                {tournament.state && `, ${tournament.state}`}
              </span>
            </div>

            {/* Entry Fee */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <IndianRupee className="w-4 h-4 text-gray-400" />
              <span>
                {tournament.entryFee ? `₹${tournament.entryFee}` : "Free"}
                {tournament.earlyBirdFee && tournament.earlyBirdDeadline && (
                  <span className="text-green-600 ml-1">
                    (Early Bird: ₹{tournament.earlyBirdFee})
                  </span>
                )}
              </span>
            </div>

            {/* Participants */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4 text-gray-400" />
              <span>
                {tournament.registeredPlayers}
                {tournament.maxPlayers && `/${tournament.maxPlayers}`} registered
              </span>
            </div>
          </div>

          {/* Registration Deadline */}
          {tournament.status === "REGISTRATION_OPEN" && (
            <div className={cn(
              "flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-3",
              isUrgent ? "bg-red-50 text-red-700" : isClosed ? "bg-gray-100 text-gray-500" : primaryBgClass
            )}>
              <Clock className="w-4 h-4" />
              <span>
                {isClosed ? (
                  "Registration closed"
                ) : isUrgent ? (
                  <strong>Only {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left to register!</strong>
                ) : (
                  `Registration ends ${formatDate(tournament.regDeadline)}`
                )}
              </span>
            </div>
          )}

          {/* Prize Pool */}
          {tournament.prizePool && tournament.prizePool > 0 && (
            <div className="flex items-center gap-2 text-sm mb-3">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-700">
                Prize Pool: ₹{tournament.prizePool.toLocaleString()}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
            >
              View Details
            </Button>

            {showRegisterButton && tournament.status === "REGISTRATION_OPEN" && !isClosed && (
              <Button
                size="sm"
                className={cn("text-white", primaryBtnClass)}
                onClick={() => router.push(`/${sport}/tournaments/${tournament.id}/team-register`)}
              >
                <Shield className="w-4 h-4 mr-1" />
                Register Team
              </Button>
            )}

            {tournament.status === "IN_PROGRESS" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/${sport}/tournaments/${tournament.id}/bracket`)}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View Bracket
              </Button>
            )}

            {tournament.status === "COMPLETED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
              >
                View Results
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
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
  if (error && !org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={fetchOrgAndTournaments} variant="outline" className="mt-4">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/college-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inter-College Tournaments</h1>
                <p className="text-gray-500">Browse and register for inter-college competitions</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("text-xs", primaryBgClass, primaryTextClass)}>
                  {sport.toUpperCase()}
                </Badge>
                <Badge className="bg-indigo-100 text-indigo-700">Inter-College</Badge>
              </div>
            </div>
          </div>

          {/* Horizontal Navbar */}
          <div className="mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-0">
                <nav className="flex items-center gap-1 px-2 py-1">
                  <Link
                    href={`/${sport}/org/college-dashboard`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>
                  <Link
                    href={`/${sport}/org/college-teams`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    College Teams
                  </Link>
                  <Link
                    href={`/${sport}/org/inter-college/tournaments`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      primaryBgClass, primaryTextClass
                    )}
                  >
                    <Trophy className="w-4 h-4" />
                    Tournaments
                  </Link>
                  <Link
                    href={`/${sport}/org/leaderboard`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Award className="w-4 h-4" />
                    Leaderboard
                  </Link>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{availableTournaments.length}</p>
                <p className="text-xs text-gray-500">Available</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{participatingTournaments.length}</p>
                <p className="text-xs text-gray-500">Participating</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">{participatedTournaments.length}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Award className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {participatedTournaments.length}
                </p>
                <p className="text-xs text-gray-500">Total History</p>
              </CardContent>
            </Card>
          </div>

          {/* Tournament Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="available" className="gap-2">
                <Trophy className="w-4 h-4" />
                Can Participate
                {availableTournaments.length > 0 && (
                  <Badge className="ml-1 bg-green-100 text-green-700 text-xs">
                    {availableTournaments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="participating" className="gap-2">
                <Users className="w-4 h-4" />
                Participating
                {participatingTournaments.length > 0 && (
                  <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">
                    {participatingTournaments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="participated" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Participated
                {participatedTournaments.length > 0 && (
                  <Badge className="ml-1 bg-purple-100 text-purple-700 text-xs">
                    {participatedTournaments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Can Participate Tab */}
            <TabsContent value="available">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Available Tournaments</CardTitle>
                  <CardDescription>
                    Inter-college tournaments with open registration. Register your college team to participate.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {availableTournaments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No tournaments available</p>
                      <p className="text-sm">Check back later for new inter-college tournaments</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {availableTournaments.map((tournament) => renderTournamentCard(tournament, true))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Participating Tab */}
            <TabsContent value="participating">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Currently Participating</CardTitle>
                  <CardDescription>
                    Active tournaments where your college team is participating.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {participatingTournaments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No active participations</p>
                      <p className="text-sm">Register for an available tournament to start competing</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {participatingTournaments.map((tournament) => renderTournamentCard(tournament, false))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Participated Tab */}
            <TabsContent value="participated">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Tournament History</CardTitle>
                  <CardDescription>
                    Past inter-college tournaments where your college participated.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {participatedTournaments.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No tournament history</p>
                      <p className="text-sm">Your completed tournaments will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {participatedTournaments.map((tournament) => renderTournamentCard(tournament, false))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Info Card */}
          <Card className={cn("mt-6 border", primaryBorderClass)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", primaryBgClass)}>
                  <Shield className={cn("w-5 h-5", primaryTextClass)} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Need to create a team?</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Before registering for inter-college tournaments, make sure you have a college team ready.
                    Go to{" "}
                    <Link href={`/${sport}/org/college-teams`} className={cn("font-medium", primaryTextClass, "hover:underline")}>
                      College Teams
                    </Link>{" "}
                    to manage your teams.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
