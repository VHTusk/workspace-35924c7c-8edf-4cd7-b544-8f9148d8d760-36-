"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BracketView from "@/components/bracket/bracket-view";
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  Medal,
  Clock,
  ChevronLeft,
  Share2,
  UserPlus,
  Check,
  AlertCircle,
  Crown,
  Loader2,
  Building2,
  RefreshCw,
  Phone,
  MessageCircle,
  User,
  ExternalLink,
  Map,
  Lock,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { fetchWithCsrf } from "@/lib/client-csrf";
import { cn } from "@/lib/utils";
import { useRazorpay, PAYMENT_TYPES, type RazorpayOptions } from "@/hooks/use-razorpay";

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    hiddenElo: number;
  };
}

interface Team {
  id: string;
  name: string;
  status: string;
  teamElo: number;
  members: TeamMember[];
}

interface Tournament {
  id: string;
  name: string;
  scope: string;
  type: string;
  format?: string;
  teamSize?: number;
  maxTeams?: number;
  location: string;
  city?: string;
  state?: string;
  startDate: string;
  endDate: string;
  regDeadline: string;
  prizePool: number;
  maxPlayers: number;
  entryFee: number;
  status: string;
  bracketFormat: string;
  description?: string;
  hostOrg?: { id: string; name: string } | null;
  // Venue and contact info
  venueGoogleMapsUrl?: string | null;
  managerName?: string;
  managerPhone?: string;
  managerWhatsApp?: string | null;
  contactPersonName?: string | null;
  contactPersonPhone?: string | null;
  contactPersonWhatsApp?: string | null;
  registrations: Array<{
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      city?: string;
      tier: string;
    };
  }>;
  teamRegistrations?: Array<{
    id: string;
    status: string;
    team: {
      id: string;
      name: string;
      members: TeamMember[];
    };
  }>;
  bracket?: {
    id: string;
    totalRounds: number;
    matches: Array<{ id: string; roundNumber: number; matchNumber: number }>;
  } | null;
}

interface RazorpayCheckoutPayload {
  orderId: string;
  amount: number;
  keyId: string;
  paymentType: 'TOURNAMENT_ENTRY' | 'TEAM_TOURNAMENT_ENTRY';
  payer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

const scopeColors: Record<string, string> = {
  CITY: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  DISTRICT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  STATE: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  NATIONAL: "bg-red-500/10 text-red-400 border-red-500/30",
};

const typeLabels: Record<string, string> = {
  INDIVIDUAL: "Individual",
  INTER_ORG: "Inter-Organization",
  INTRA_ORG: "Intra-Organization",
};

const typeColors: Record<string, string> = {
  INDIVIDUAL: "bg-muted/50 text-muted-foreground border-border",
  INTER_ORG: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  INTRA_ORG: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const formatLabels: Record<string, string> = {
  INDIVIDUAL: "1v1 Singles",
  DOUBLES: "2v2 Doubles",
  TEAM: "Team (3-4 players)",
};

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState("");
  const [userType, setUserType] = useState<"player" | "org" | null>(null);

  // Tournament results/leaderboard for completed tournaments
  const [tournamentResults, setTournamentResults] = useState<Array<{
    rank: number;
    userId: string;
    name: string;
    city: string | null;
    points: number;
    matches: number;
    wins: number;
  }>>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Team registration state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamRegistering, setTeamRegistering] = useState(false);
  useEffect(() => {
    fetchTournament();
    checkAuth();
  }, [tournamentId]);

  // Fetch tournament results when tournament is completed
  useEffect(() => {
    if (tournament?.status === "COMPLETED") {
      fetchTournamentResults();
    }
  }, [tournament?.status]);

  useEffect(() => {
    if (error && tournament) {
      toast.error(error, { id: "tournament-detail-error" });
    }
  }, [error, tournament]);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournaments/${tournamentId}`);
      if (response.ok) {
        const data = await response.json();
        setTournament(data.tournament);
      } else {
        setError("Tournament not found");
      }
    } catch (err) {
      setError("Failed to load tournament");
    } finally {
      setLoading(false);
    }
  };

  const fetchTournamentResults = async () => {
    try {
      setLoadingResults(true);
      const response = await fetch(`/api/public/tournament/recap?tournamentId=${tournamentId}`);
      if (response.ok) {
        const data = await response.json();
        setTournamentResults(data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch tournament results:", err);
    } finally {
      setLoadingResults(false);
    }
  };

  const checkAuth = async () => {
    try {
      // Check player session
      const playerRes = await fetch(`/api/auth/check?sport=${sport.toUpperCase()}`, {
        credentials: "include",
      });
      if (playerRes.ok) {
        const playerData = await playerRes.json();
        if (playerData.authenticated && playerData.userType === "player") {
          setUserType("player");
          return;
        }
      }

      // Check org session
      const orgRes = await fetch("/api/org/me", {
        credentials: "include",
      });
      if (orgRes.ok) {
        setUserType("org");
        return;
      }
    } catch {
      // Not logged in
    }
  };

  const fetchUserTeams = async () => {
    try {
      setLoadingTeams(true);
      const response = await fetch(`/api/teams?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only ACTIVE teams
        const activeTeams = (data.teams || []).filter(
          (t: Team) => t.status === "ACTIVE"
        );
        setTeams(activeTeams);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleRegister = async () => {
    if (!tournament) return;

    // For DOUBLES tournaments, show team selection modal
    if (tournament.format === "DOUBLES") {
      await fetchUserTeams();
      setShowTeamModal(true);
      return;
    }

    // For INTER_ORG, redirect to org entry page
    if (tournament.type === "INTER_ORG") {
      router.push(`/${sport}/tournaments/${tournamentId}/enter`);
      return;
    }

    // For INDIVIDUAL and INTRA_ORG, individual player registration
    setIsRegistering(true);
    try {
      const response = await fetchWithCsrf(`/api/tournaments/${tournamentId}/register`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle subscription required - redirect to subscription page
        if (data.code === 'SUBSCRIPTION_REQUIRED') {
          router.push(data.subscriptionUrl || `/${sport}/subscription`);
          return;
        }
        setError(data.error || "Registration failed");
        return;
      }

      if (data.requiresPayment) {
        openRazorpayCheckout({
          orderId: data.order.id,
          amount: data.order.amount,
          keyId: data.keyId,
          paymentType: 'TOURNAMENT_ENTRY',
          payer: data.payer,
        });
        return;
      }

      setIsRegistered(true);
      fetchTournament();
    } catch (err) {
      setError("Registration failed");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleTeamRegister = async () => {
    if (!selectedTeam || !tournament) return;

    setTeamRegistering(true);
    setError("");

    try {
      const response = await fetchWithCsrf(`/api/tournaments/${tournamentId}/team-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeam.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle subscription required - redirect to subscription page
        if (data.code === 'SUBSCRIPTION_REQUIRED') {
          router.push(data.subscriptionUrl || `/${sport}/subscription`);
          return;
        }
        setError(data.error || "Team registration failed");
        return;
      }

      if (data.requiresPayment) {
        openRazorpayCheckout({
          orderId: data.order.id,
          amount: data.order.amount,
          keyId: data.keyId,
          paymentType: 'TEAM_TOURNAMENT_ENTRY',
          payer: data.payer,
        });
      } else {
        // Free tournament, registration complete
        setShowTeamModal(false);
        setIsRegistered(true);
        toast.success("Registration completed successfully.", { id: "tournament-detail-success" });
        fetchTournament();
      }
    } catch (err) {
      setError("Team registration failed");
    } finally {
      setTeamRegistering(false);
    }
  };

  // Razorpay checkout handler
  const openRazorpayCheckout = useCallback((paymentData: RazorpayCheckoutPayload) => {
    // Load Razorpay script if not already loaded
    const loadRazorpay = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };

    loadRazorpay().then((loaded) => {
      if (!loaded) {
        setError("Failed to load payment gateway. Please try again.");
        return;
      }

      const options: RazorpayOptions = {
        key: paymentData.keyId,
        amount: paymentData.amount,
        currency: 'INR',
        name: 'VALORHIVE',
        description: `Tournament Registration - ${tournament?.name || 'Tournament'}`,
        order_id: paymentData.orderId,
        handler: async (response) => {
          // Payment successful - verify on server
          try {
            const verifyRes = await fetchWithCsrf('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                paymentType: paymentData.paymentType,
                sport: sport.toUpperCase(),
                tournamentId,
              }),
            });

            if (verifyRes.ok) {
              setShowTeamModal(false);
              setIsRegistered(true);
              toast.success("Payment successful. Registration confirmed.", { id: "tournament-detail-success" });
              // Refresh tournament data
              fetchTournament();
            } else {
              const verifyData = await verifyRes.json();
              setError(verifyData.error || 'Payment verification failed');
            }
          } catch (err) {
            setError('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: paymentData.payer?.name || '',
          email: paymentData.payer?.email || '',
          contact: paymentData.payer?.phone || '',
        },
        theme: {
          color: isCornhole ? '#16a34a' : '#14b8a6',
        },
        modal: {
          ondismiss: () => {
            setTeamRegistering(false);
            setIsRegistering(false);
            // Payment cancelled - keep modal open
            setError('Payment cancelled. Please try again.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  }, [tournament?.name, sport, tournamentId, isCornhole, fetchTournament]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="py-8 px-4">
        <div className="container mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error || "Tournament not found"}</AlertDescription>
          </Alert>
          <Link href={`/${sport}/tournaments`}>
            <Button variant="outline" className="mt-4">Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDoubles = tournament.format === "DOUBLES";
  const registeredCount = isDoubles
    ? (tournament.teamRegistrations?.length || 0)
    : (tournament.registrations?.length || 0);
  const maxCount = isDoubles
    ? (tournament.maxTeams || tournament.maxPlayers)
    : tournament.maxPlayers;
  const spotsLeft = maxCount - registeredCount;
  const isRegistrationOpen = tournament.status === "REGISTRATION_OPEN" && spotsLeft > 0;

  const primaryTextClass = isCornhole 
    ? "text-green-500 dark:text-green-400" 
    : "text-teal-500 dark:text-teal-400";
  const primaryBgClass = isCornhole 
    ? "bg-green-500/10 dark:bg-green-500/20" 
    : "bg-teal-500/10 dark:bg-teal-500/20";
  const primaryBtnClass = isCornhole 
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600" 
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  const getRegistrationButton = () => {
    if (isRegistered) {
      return (
        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2" disabled>
          <Check className="w-4 h-4" />
          {isDoubles ? "Team Registered" : "Registered"}
        </Button>
      );
    }

    if (!isRegistrationOpen) {
      return (
        <Button disabled className="gap-2">
          <AlertCircle className="w-4 h-4" />
          Registration Closed
        </Button>
      );
    }

    // DOUBLES tournament
    if (isDoubles) {
      return (
        <Button
          className={cn("text-white gap-2", primaryBtnClass)}
          onClick={handleRegister}
          disabled={isRegistering}
        >
          <Users className="w-4 h-4" />
          {isRegistering ? "Loading..." : "Register Team"}
        </Button>
      );
    }

    // INTER_ORG tournament
    if (tournament.type === "INTER_ORG") {
      if (userType === "org") {
        return (
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            onClick={handleRegister}
          >
            <Building2 className="w-4 h-4" />
            Enter Players
          </Button>
        );
      } else {
        return (
          <Button disabled className="gap-2">
            <Building2 className="w-4 h-4" />
            Org Registration Only
          </Button>
        );
      }
    }

    // INTRA_ORG - check if player belongs to host org
    if (tournament.type === "INTRA_ORG") {
      return (
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          onClick={handleRegister}
          disabled={isRegistering}
        >
          <UserPlus className="w-4 h-4" />
          {isRegistering ? "Registering..." : "Register Now"}
        </Button>
      );
    }

    // INDIVIDUAL tournament
    return (
      <Button
        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        onClick={handleRegister}
        disabled={isRegistering}
      >
        <UserPlus className="w-4 h-4" />
        {isRegistering ? "Registering..." : "Register Now"}
      </Button>
    );
  };

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Back Button */}
        <Link href={`/${sport}/tournaments`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="w-4 h-4" />
          Back to Tournaments
        </Link>

        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          {/* Main Info */}
          <div className="flex-1">
            <div className="flex items-start gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-3xl font-bold text-foreground">{tournament.name}</h1>
                  <Badge variant="outline" className={scopeColors[tournament.scope]}>
                    {tournament.scope}
                  </Badge>
                  <Badge variant="outline" className={typeColors[tournament.type]}>
                    {typeLabels[tournament.type]}
                  </Badge>
                  {tournament.format && (
                    <Badge variant="outline" className={cn(primaryBgClass, primaryTextClass, "border-transparent")}>
                      {formatLabels[tournament.format] || tournament.format}
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {tournament.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-5 h-5" />
                <span>{new Date(tournament.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-5 h-5" />
                <span className="truncate">{tournament.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-5 h-5" />
                <span>{registeredCount}/{maxCount} {isDoubles ? "Teams" : "Players"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-5 h-5" />
                <span>₹{(tournament.prizePool / 1000).toFixed(0)}K Prize</span>
              </div>
            </div>

            {/* Doubles tournament info */}
            {isDoubles && (
              <div className={cn("mb-4 p-3 rounded-lg border", primaryBgClass, isCornhole ? "border-green-500/30" : "border-teal-500/30")}>
                <p className={cn("text-sm", primaryTextClass)}>
                  <Users className="w-4 h-4 inline mr-1" />
                  <strong>Doubles Tournament:</strong> Register with a partner. Team captain pays the entry fee.
                  {tournament.teamSize && ` ${tournament.teamSize} players per team.`}
                </p>
              </div>
            )}

            {tournament.type === "INTRA_ORG" && tournament.hostOrg && (
              <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <p className="text-sm text-purple-400">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Hosted by: <strong>{tournament.hostOrg.name}</strong>
                </p>
              </div>
            )}

            {tournament.type === "INTER_ORG" && (
              <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-400">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Organizations register and select their roster players.
                  One-time entry fee: ₹{tournament.entryFee}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {getRegistrationButton()}
              <Button variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>

          {/* Registration Card */}
          <Card className="bg-card border-border/50 lg:w-80">
            <CardHeader>
              <CardTitle className="text-lg">Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-3xl font-bold text-foreground">
                  ₹{tournament.entryFee}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isDoubles ? "Entry Fee per Team" : "Entry Fee per Player"}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Format</span>
                  <span className="text-foreground">
                    {tournament.format ? formatLabels[tournament.format] : tournament.bracketFormat?.replace(/_/g, " ") || "TBD"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spots Left</span>
                  <span className={spotsLeft < 10 ? "text-amber-400 font-medium" : "text-foreground"}>
                    {spotsLeft} of {maxCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deadline</span>
                  <span className="text-foreground">
                    {new Date(tournament.regDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Prize Distribution</p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-400" /> 1st Place
                    </span>
                    <span className="text-foreground font-medium">₹{Math.floor(tournament.prizePool * 0.5).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">2nd Place</span>
                    <span className="text-foreground font-medium">₹{Math.floor(tournament.prizePool * 0.3).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">3rd Place</span>
                    <span className="text-foreground font-medium">₹{Math.floor(tournament.prizePool * 0.2).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Venue & Contact Information Card */}
          <Card className="bg-card border-border/50 lg:w-80">
            <CardHeader>
              <CardTitle className="text-lg">Venue & Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Venue Location */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Location</p>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-sm">{tournament.location}</span>
                    {tournament.city && tournament.state && (
                      <span className="text-sm block">{tournament.city}, {tournament.state}</span>
                    )}
                  </div>
                </div>
                {tournament.venueGoogleMapsUrl && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={tournament.venueGoogleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-lg transition-colors"
                    >
                      <Map className="w-4 h-4" />
                      <span>View on Map</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tournament.location + (tournament.city ? `, ${tournament.city}` : '') + (tournament.state ? `, ${tournament.state}` : ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Get Directions</span>
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              {/* Tournament Manager */}
              {tournament.managerName && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Tournament Manager</p>
                    <Badge variant="outline" className="text-xs">Primary</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{tournament.managerName}</p>
                  {isRegistered ? (
                    <div className="mt-2 space-y-2">
                      {tournament.managerPhone && (
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`https://wa.me/${(tournament.managerWhatsApp || tournament.managerPhone || '').replace(/[\s\-\(\)]/g, '').replace(/^(\+|0)/, '91')}?text=${encodeURIComponent(`Hi ${tournament.managerName}, I have a query about ${tournament.name} tournament.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>WhatsApp</span>
                          </a>
                          <a
                            href={`tel:${tournament.managerPhone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-lg transition-colors border border-border"
                          >
                            <Phone className="w-4 h-4" />
                            <span>Call</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                      <Lock className="w-3 h-3" />
                      <span>Contact visible after registration</span>
                    </div>
                  )}
                </div>
              )}

              {/* Contact Person (if exists) */}
              {tournament.contactPersonName && isRegistered && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Contact Person</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{tournament.contactPersonName}</p>
                    <div className="mt-2 space-y-2">
                      {tournament.contactPersonPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <a 
                            href={`tel:${tournament.contactPersonPhone}`}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            {tournament.contactPersonPhone}
                          </a>
                        </div>
                      )}
                      {(tournament.contactPersonWhatsApp || tournament.contactPersonPhone) && (
                        <a
                          href={`https://wa.me/${(tournament.contactPersonWhatsApp || tournament.contactPersonPhone || '').replace(/[\s\-\(\)]/g, '').replace(/^(\+|0)/, '91')}?text=${encodeURIComponent(`Hi ${tournament.contactPersonName}, I have a query about ${tournament.name} tournament.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-full transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={
          tournament.status === "COMPLETED" ? "leaderboard" : 
          isDoubles ? "teams" : "players"
        } className="space-y-6">
          <TabsList>
            {tournament.status === "COMPLETED" && (
              <TabsTrigger value="leaderboard" className="gap-2">
                <Medal className="w-4 h-4" />
                Leaderboard
              </TabsTrigger>
            )}
            {isDoubles ? (
              <TabsTrigger value="teams">Registered Teams</TabsTrigger>
            ) : (
              <TabsTrigger value="players">Registered Players</TabsTrigger>
            )}
            <TabsTrigger value="rules">Rules & Info</TabsTrigger>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
          </TabsList>

          {/* Leaderboard Tab for Completed Tournaments */}
          {tournament.status === "COMPLETED" && (
            <TabsContent value="leaderboard">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Medal className="w-5 h-5 text-amber-500" />
                    Tournament Leaderboard
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Final standings based on match results
                  </p>
                </CardHeader>
                <CardContent>
                  {loadingResults ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : tournamentResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No results available yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tournamentResults.map((player, index) => {
                        const isTop3 = player.rank <= 3;
                        const medalEmoji = player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : null;
                        
                        return (
                          <div
                            key={player.userId}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                              isTop3 && player.rank === 1 && "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
                              isTop3 && player.rank === 2 && "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800",
                              isTop3 && player.rank === 3 && "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
                              !isTop3 && "bg-muted/30 border-border/50 hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                              player.rank === 1 && "text-amber-600 dark:text-amber-400",
                              player.rank === 2 && "text-gray-600 dark:text-gray-400",
                              player.rank === 3 && "text-orange-600 dark:text-orange-400",
                              !isTop3 && "text-muted-foreground"
                            )}>
                              {medalEmoji || `#${player.rank}`}
                            </div>
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className={cn(
                                "bg-primary/10 text-primary font-medium",
                                player.rank === 1 && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              )}>
                                {player.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={`/${sport}/players/${player.userId}`}
                                className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                              >
                                {player.name}
                              </Link>
                              <p className="text-xs text-muted-foreground truncate">
                                {player.city || ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "font-bold",
                                player.rank === 1 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                              )}>
                                +{player.points} pts
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {player.wins}W - {player.matches - player.wins}L
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Teams Tab for Doubles */}
          {isDoubles && (
            <TabsContent value="teams">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle>Registered Teams ({tournament.teamRegistrations?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {!tournament.teamRegistrations || tournament.teamRegistrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No teams registered yet</p>
                      <p className="text-sm">Be the first to register your team!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tournament.teamRegistrations.map((reg) => (
                        <div key={reg.id} className="p-4 rounded-lg bg-muted/50 border border-border/50">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className={cn("w-5 h-5", primaryTextClass)} />
                            <span className="font-medium text-foreground">{reg.team.name}</span>
                            <Badge variant="outline" className={cn(
                              reg.status === "CONFIRMED" ? "text-green-500 border-green-500/30" : "text-amber-500 border-amber-500/30"
                            )}>
                              {reg.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {reg.team.members.map((member) => (
                              <div key={member.id} className="flex items-center gap-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className={cn("text-xs", primaryBgClass, primaryTextClass)}>
                                    {member.user.firstName[0]}{member.user.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">
                              {reg.team.members.map(m => `${m.user.firstName} ${m.user.lastName[0]}.`).join(" & ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Players Tab for Individual */}
          {!isDoubles && (
            <TabsContent value="players">
              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle>Registered Players ({tournament.registrations?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {!tournament.registrations || tournament.registrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No players registered yet</p>
                      <p className="text-sm">Be the first to register!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tournament.registrations.map((reg) => (
                        <div key={reg.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                          <Avatar>
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {reg.user.firstName[0]}{reg.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {reg.user.firstName} {reg.user.lastName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {reg.user.city && <span>{reg.user.city}</span>}
                              <Badge variant="outline" className="text-xs py-0">
                                {reg.user.tier}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="rules">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle>Tournament Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm flex-shrink-0">
                      1
                    </div>
                    <span className="text-muted-foreground">Standard rules apply for {sport}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm flex-shrink-0">
                      2
                    </div>
                    <span className="text-muted-foreground">Best of 3 games per match</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm flex-shrink-0">
                      3
                    </div>
                    <span className="text-muted-foreground">All {isDoubles ? "team members" : "players"} must check in 30 minutes before their match</span>
                  </li>
                </ul>

                <Separator className="my-6" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Important Dates</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Registration Deadline</span>
                        <span className="text-foreground">{new Date(tournament.regDeadline).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tournament Start</span>
                        <span className="text-foreground">{new Date(tournament.startDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tournament End</span>
                        <span className="text-foreground">{new Date(tournament.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Refund Policy</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• 100% refund if cancelled 48+ hours before</p>
                      <p>• 50% refund if cancelled 24-48 hours before</p>
                      <p>• No refund if cancelled less than 24 hours</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bracket">
            <BracketView tournamentId={tournamentId} sport={sport} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Team Selection Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Your Team</DialogTitle>
            <DialogDescription>
              Select your team to register for this doubles tournament. Only you (as captain) will pay the entry fee.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingTeams ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">You don&apos;t have an active team yet</p>
                <Button
                  onClick={() => {
                    setShowTeamModal(false);
                    router.push(`/${sport}/teams`);
                  }}
                  className={cn("text-white", primaryBtnClass)}
                >
                  Create a Team
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                      selectedTeam?.id === team.id
                        ? cn(primaryBgClass, isCornhole ? "border-green-500" : "border-teal-500")
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Users className={cn("w-5 h-5", primaryTextClass)} />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.members.map(m => `${m.user.firstName} ${m.user.lastName[0]}.`).join(" & ")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">ELO: {Math.round(team.teamElo)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeamModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTeamRegister}
              disabled={!selectedTeam || teamRegistering}
              className={cn("text-white", primaryBtnClass)}
            >
              {teamRegistering ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  Register Team • ₹{tournament.entryFee}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
