"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trophy,
  Bell,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Users,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowedTournament {
  watcherId: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStatus: string;
  sport: string;
  location: string;
  startDate: string;
  registeredPlayers: number;
  maxPlayers: number;
  prizePool: number;
  contactMethod: "email" | "phone";
  contactValue: string;
  verified: boolean;
}

export default function MyFollowsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const primaryClass = isCornhole 
    ? "bg-green-600 hover:bg-green-700" 
    : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tournaments, setTournaments] = useState<FollowedTournament[]>([]);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!email && !phone) {
      setError("Please enter your email or phone");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (contactMethod === "email" && email) params.append("email", email);
      if (contactMethod === "phone" && phone) params.append("phone", phone);

      const response = await fetch(`/api/public/watchers/my-tournaments?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setTournaments(data.tournaments || []);
      } else {
        setTournaments([]);
      }
      
      setSearched(true);
    } catch (err) {
      setError("Failed to fetch your followed tournaments");
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (watcherId: string) => {
    try {
      const response = await fetch(`/api/public/watchers/${watcherId}/unsubscribe`, {
        method: "POST",
      });

      if (response.ok) {
        setTournaments(tournaments.filter(t => t.watcherId !== watcherId));
      }
    } catch (err) {
      console.error("Failed to unfollow:", err);
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-500/10 text-gray-400",
    REGISTRATION_OPEN: "bg-green-500/10 text-green-400",
    REGISTRATION_CLOSED: "bg-yellow-500/10 text-yellow-400",
    BRACKET_GENERATED: "bg-blue-500/10 text-blue-400",
    IN_PROGRESS: "bg-purple-500/10 text-purple-400",
    COMPLETED: "bg-muted text-muted-foreground",
    CANCELLED: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Bell className={cn("h-8 w-8", primaryTextClass)} />
            My Followed Tournaments
          </h1>
          <p className="text-muted-foreground">
            View and manage tournaments you&apos;re following
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Find Your Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={contactMethod === "email" ? "default" : "outline"}
                  onClick={() => setContactMethod("email")}
                  className={contactMethod === "email" ? primaryClass : ""}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant={contactMethod === "phone" ? "default" : "outline"}
                  onClick={() => setContactMethod("phone")}
                  className={contactMethod === "phone" ? primaryClass : ""}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>

              {contactMethod === "email" ? (
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="phone">WhatsApp Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {error && (
                <div className="text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleSearch}
                disabled={loading}
                className={cn("w-full", primaryClass)}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Find My Tournaments
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            {tournaments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No tournaments found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    You haven&apos;t followed any tournaments with this {contactMethod}
                  </p>
                  <Link href={`/${sport}/tournaments`}>
                    <Button className={primaryClass}>
                      <Trophy className="h-4 w-4 mr-2" />
                      Browse Tournaments
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              tournaments.map((tournament) => (
                <Card key={tournament.watcherId} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <Link 
                            href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.tournamentId}`}
                            className="text-lg font-semibold text-foreground hover:underline"
                          >
                            {tournament.tournamentName}
                          </Link>
                          <Badge variant="outline" className={statusColors[tournament.tournamentStatus] || ""}>
                            {tournament.tournamentStatus.replace(/_/g, " ")}
                          </Badge>
                          {tournament.verified && (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {tournament.location}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {tournament.registeredPlayers}/{tournament.maxPlayers}
                          </div>
                          {tournament.prizePool > 0 && (
                            <div className="flex items-center gap-1">
                              <Trophy className="h-4 w-4" />
                              ₹{(tournament.prizePool / 1000).toFixed(0)}K
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">
                          Following via {tournament.contactMethod}: {tournament.contactValue}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Link href={`/${tournament.sport.toLowerCase()}/tournaments/${tournament.tournamentId}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnfollow(tournament.watcherId)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Unfollow
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
