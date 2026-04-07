"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Calendar,
  Trophy,
  Users,
  Clock,
  IndianRupee,
  ArrowLeft,
  Share2,
  User,
  Building2,
  Target,
  Medal,
  ExternalLink,
} from "lucide-react";

interface TournamentDetailClientProps {
  initialTournament: {
    id: string;
    name: string;
    sport: string;
    type: string;
    scope: string | null;
    location: string;
    city: string | null;
    state: string | null;
    startDate: string;
    endDate: string;
    regDeadline: string;
    prizePool: number;
    entryFee: number;
    maxPlayers: number;
    currentRegistrations: number;
    totalMatches: number;
    status: string;
    bracketFormat: string | null;
    gender: string | null;
    ageMin: number | null;
    ageMax: number | null;
    hostOrg: {
      id: string;
      name: string;
      logoUrl: string | null;
      city: string | null;
      state: string | null;
    } | null;
    sponsors: Array<{
      name: string;
      logoUrl: string | null;
      tier: string | null;
    }>;
    earlyBirdFee: number | null;
    earlyBirdDeadline: string | null;
    groupDiscountMin: number | null;
    groupDiscountPercent: number | null;
    bracket: {
      id: string;
      format: string;
      totalRounds: number;
      matches: Array<{
        id: string;
        roundNumber: number;
        matchNumber: number;
        status: string;
        playerA: { id: string; firstName: string; lastName: string } | null;
        playerB: { id: string; firstName: string; lastName: string } | null;
        winner: { id: string; firstName: string; lastName: string } | null;
        scheduledAt: string | null;
        courtAssignment: string | null;
      }>;
    } | null;
    topResults: Array<{
      rank: number;
      points: number;
      player: { id: string; firstName: string; lastName: string };
    }> | null;
    isRegistrationOpen: boolean;
  };
}

export function TournamentDetailClient({ initialTournament }: TournamentDetailClientProps) {
  const router = useRouter();
  const tournament = initialTournament;
  
  const isCornhole = tournament.sport === "CORNHOLE";
  const primaryColor = isCornhole ? "green" : "teal";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const regDeadline = new Date(tournament.regDeadline);
  const now = new Date();

  const isEarlyBird = tournament.earlyBirdDeadline && 
    new Date(tournament.earlyBirdDeadline) > now;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusBadge = () => {
    switch (tournament.status) {
      case "REGISTRATION_OPEN":
        return <Badge className="bg-green-500 text-lg px-4 py-1">Registration Open</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-500 text-lg px-4 py-1 animate-pulse">Live Now</Badge>;
      case "COMPLETED":
        return <Badge variant="outline" className="text-lg px-4 py-1">Completed</Badge>;
      case "BRACKET_GENERATED":
        return <Badge className="bg-purple-500 text-lg px-4 py-1">Starting Soon</Badge>;
      default:
        return <Badge variant="secondary" className="text-lg px-4 py-1">{tournament.status}</Badge>;
    }
  };

  const getBracketFormatLabel = (format: string | null) => {
    if (!format) return "TBD";
    switch (format) {
      case "SINGLE_ELIMINATION": return "Single Elimination";
      case "DOUBLE_ELIMINATION": return "Double Elimination";
      case "ROUND_ROBIN": return "Round Robin";
      default: return format;
    }
  };

  const getTournamentTypeLabel = (type: string) => {
    switch (type) {
      case "INDIVIDUAL": return "Individual Entry";
      case "INTER_ORG": return "Inter-Organization";
      case "INTRA_ORG": return "Intra-Organization";
      default: return type;
    }
  };

  const handleRegister = () => {
    router.push(`/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}/enter`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: tournament.name,
      text: `Check out ${tournament.name} - ${tournament.sport.toLowerCase()} tournament in ${tournament.location}`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className={`${primaryBgClass} border-b ${primaryBorderClass}`}>
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/tournaments" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-sm text-gray-500">Back to Tournaments</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className={`${primaryBorderClass} ${primaryTextClass}`}>
                  {isCornhole ? "Cornhole" : "Darts"}
                </Badge>
                {tournament.scope && (
                  <Badge variant="secondary">{tournament.scope}</Badge>
                )}
                {getStatusBadge()}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{tournament.location}</span>
                {tournament.city && <span>, {tournament.city}</span>}
                {tournament.state && <span>, {tournament.state}</span>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              {tournament.isRegistrationOpen && (
                <Button className={primaryBtnClass} onClick={handleRegister}>
                  Register Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Key Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Date
              </div>
              <p className="font-semibold">{formatDate(startDate)}</p>
              {startDate.toDateString() !== endDate.toDateString() && (
                <p className="text-sm text-gray-500">to {formatDate(endDate)}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Trophy className="w-4 h-4" />
                Prize Pool
              </div>
              <p className="font-bold text-xl">{formatCurrency(tournament.prizePool)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Users className="w-4 h-4" />
                Players
              </div>
              <p className="font-semibold">
                {tournament.currentRegistrations} / {tournament.maxPlayers}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`h-2 rounded-full ${tournament.currentRegistrations >= tournament.maxPlayers ? 'bg-red-500' : primaryBgClass.replace('bg-', 'bg-').replace('-50', '-500')}`}
                  style={{ width: `${Math.min((tournament.currentRegistrations / tournament.maxPlayers) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Target className="w-4 h-4" />
                Format
              </div>
              <p className="font-semibold">{getBracketFormatLabel(tournament.bracketFormat)}</p>
              <p className="text-sm text-gray-500">{getTournamentTypeLabel(tournament.type)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Entry Fee & Registration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entry Fee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {isEarlyBird && tournament.earlyBirdFee && tournament.earlyBirdDeadline ? (
                  <>
                    <p className="text-sm text-gray-500 line-through">
                      {formatCurrency(tournament.entryFee)}
                    </p>
                    <p className={`text-2xl font-bold ${primaryTextClass}`}>
                      {formatCurrency(tournament.earlyBirdFee)}
                      <Badge className="ml-2 bg-amber-500">Early Bird</Badge>
                    </p>
                    <p className="text-sm text-gray-500">
                      Ends {new Date(tournament.earlyBirdDeadline).toLocaleDateString("en-IN")}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold">{formatCurrency(tournament.entryFee)}</p>
                )}
                {tournament.groupDiscountMin && tournament.groupDiscountPercent && (
                  <p className="text-sm text-green-600 mt-2">
                    Group discount: {tournament.groupDiscountPercent}% off for {tournament.groupDiscountMin}+ players
                  </p>
                )}
              </div>
              
              {tournament.isRegistrationOpen ? (
                <div className="text-right">
                  <Button className={primaryBtnClass} onClick={handleRegister}>
                    Register Now
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Closes {formatDate(regDeadline)}
                  </p>
                </div>
              ) : tournament.status === "IN_PROGRESS" ? (
                <Badge className="bg-blue-500 text-lg">Tournament Live</Badge>
              ) : tournament.status === "COMPLETED" ? (
                <Badge variant="outline" className="text-lg">Tournament Ended</Badge>
              ) : (
                <Badge variant="secondary" className="text-lg">Registration Closed</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bracket Preview (if available) */}
        {tournament.bracket && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Bracket</CardTitle>
              <Link href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.id}/bracket`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Full Bracket
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  {tournament.bracket.totalRounds} rounds • {tournament.bracket.matches.length} matches
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {tournament.bracket.matches.slice(0, 10).map((match) => (
                    <div 
                      key={match.id}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        match.status === "COMPLETED" 
                          ? "bg-gray-100" 
                          : match.status === "LIVE" 
                            ? `${primaryBgClass} border ${primaryBorderClass}` 
                            : "bg-gray-50"
                      }`}
                    >
                      <span className="text-gray-500 text-xs w-16">
                        R{match.roundNumber} M{match.matchNumber}
                      </span>
                      <div className="flex-1 flex items-center justify-center gap-2">
                        <span className={match.winner?.id === match.playerA?.id ? "font-bold" : ""}>
                          {match.playerA?.firstName || "TBD"} {match.playerA?.lastName?.charAt(0) || ""}
                        </span>
                        <span className="text-gray-400">vs</span>
                        <span className={match.winner?.id === match.playerB?.id ? "font-bold" : ""}>
                          {match.playerB?.firstName || "TBD"} {match.playerB?.lastName?.charAt(0) || ""}
                        </span>
                      </div>
                      {match.status === "COMPLETED" && match.winner && (
                        <Badge variant="outline" className="text-xs">Won</Badge>
                      )}
                      {match.status === "LIVE" && (
                        <Badge className="bg-blue-500 text-xs">Live</Badge>
                      )}
                    </div>
                  ))}
                  {tournament.bracket.matches.length > 10 && (
                    <p className="text-center text-sm text-gray-500 pt-2">
                      +{tournament.bracket.matches.length - 10} more matches
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Results (if completed) */}
        {tournament.topResults && tournament.topResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Medal className="w-5 h-5" />
                Final Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tournament.topResults.map((result) => (
                  <div 
                    key={result.rank}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.rank === 1 ? "bg-amber-50 border border-amber-200" :
                      result.rank === 2 ? "bg-gray-100 border border-gray-200" :
                      result.rank === 3 ? "bg-orange-50 border border-orange-200" :
                      "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${
                        result.rank === 1 ? "text-amber-500" :
                        result.rank === 2 ? "text-gray-400" :
                        result.rank === 3 ? "text-orange-400" :
                        "text-gray-500"
                      }`}>
                        {result.rank}
                      </span>
                      <Link 
                        href={`/${tournament.sport.toLowerCase()}/players/${result.player.id}`}
                        className="font-medium hover:underline"
                      >
                        {result.player.firstName} {result.player.lastName}
                      </Link>
                    </div>
                    <Badge variant="outline">+{result.points} pts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Host Organization */}
        {tournament.hostOrg && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Host Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link 
                href={`/${tournament.sport.toLowerCase()}/organizations/${tournament.hostOrg.id}`}
                className="flex items-center gap-4 hover:bg-gray-50 p-2 rounded-lg transition-colors"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  {tournament.hostOrg.logoUrl ? (
                    <img 
                      src={tournament.hostOrg.logoUrl} 
                      alt={tournament.hostOrg.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{tournament.hostOrg.name}</p>
                  {(tournament.hostOrg.city || tournament.hostOrg.state) && (
                    <p className="text-sm text-gray-500">
                      {tournament.hostOrg.city}{tournament.hostOrg.city && tournament.hostOrg.state && ", "}
                      {tournament.hostOrg.state}
                    </p>
                  )}
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Eligibility */}
        {(tournament.gender || tournament.ageMin || tournament.ageMax) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tournament.gender && (
                <p className="text-sm">
                  <span className="text-gray-500">Category:</span>{" "}
                  <span className="font-medium">
                    {tournament.gender === "MALE" ? "Men's" : 
                     tournament.gender === "FEMALE" ? "Women's" : 
                     "Mixed"}
                  </span>
                </p>
              )}
              {(tournament.ageMin || tournament.ageMax) && (
                <p className="text-sm">
                  <span className="text-gray-500">Age:</span>{" "}
                  <span className="font-medium">
                    {tournament.ageMin ? `${tournament.ageMin}+` : "All ages"}
                    {tournament.ageMax && ` up to ${tournament.ageMax}`}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sponsors */}
        {tournament.sponsors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sponsors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {tournament.sponsors.map((sponsor, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded">
                    {sponsor.logoUrl ? (
                      <img src={sponsor.logoUrl} alt={sponsor.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{sponsor.name}</span>
                    {sponsor.tier && (
                      <Badge variant="outline" className="text-xs">{sponsor.tier}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          <Link href="/" className="font-semibold text-gray-900 hover:underline">
            VALORHIVE
          </Link>
          {" "}- India's Premier Cornhole & Darts Tournament Platform
        </div>
      </footer>
    </div>
  );
}
