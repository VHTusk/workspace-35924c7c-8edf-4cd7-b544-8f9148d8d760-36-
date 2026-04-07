"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  Users,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trophy,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WaitlistEntry {
  id: string;
  position: number;
  status: string;
  createdAt: string;
  promotedAt: string | null;
  expiresAt: string | null;
  tournament: {
    id: string;
    name: string;
    sport: string;
    startDate: string;
    location: string;
    maxPlayers: number;
    status: string;
  };
  totalWaitlist: number;
  spotsFilled: number;
  spotsLeft: number;
}

export default function WaitlistPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchWaitlist();
  }, [sport]);

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/player/waitlist");
      if (response.ok) {
        const data = await response.json();
        // Filter by current sport
        const filtered = data.waitlist.filter(
          (entry: WaitlistEntry) => entry.tournament.sport === sport.toUpperCase()
        );
        setWaitlist(filtered);
      } else if (response.status === 401) {
        router.push(`/${sport}/login?redirect=/${sport}/waitlist`);
      }
    } catch (err) {
      console.error("Failed to fetch waitlist:", err);
      setError("Failed to load waitlist");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveWaitlist = async (tournamentId: string) => {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(`/api/tournaments/${tournamentId}/waitlist`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to leave waitlist");
        return;
      }

      setSuccess("Successfully left waitlist");
      fetchWaitlist();
    } catch (err) {
      setError("An error occurred");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "WAITING":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Waiting
          </Badge>
        );
      case "PROMOTED":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Promoted!
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPositionLabel = (position: number) => {
    if (position === 1) return "1st";
    if (position === 2) return "2nd";
    if (position === 3) return "3rd";
    return `${position}th`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-72">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Waitlist</h1>
            <p className="text-gray-500">Tournaments you're waiting to join</p>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">{success}</AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info Card */}
          <Card className={cn("mb-6 border-l-4", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Clock className={cn("w-5 h-5 flex-shrink-0", primaryTextClass)} />
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">How the waitlist works</p>
                  <ul className="space-y-1">
                    <li>• When a spot opens up, the first person on the waitlist gets promoted</li>
                    <li>• You'll have 24 hours to complete your registration after being promoted</li>
                    <li>• You'll receive an email notification when you're promoted</li>
                    <li>• Your position updates automatically as others leave or get promoted</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Waitlist Entries */}
          {waitlist.length === 0 ? (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No Waitlist Entries</h3>
                <p className="text-gray-500 mb-4">
                  You're not on any tournament waitlists. When tournaments are full, you can join the waitlist for a chance to participate.
                </p>
                <Link href={`/${sport}/tournaments`}>
                  <Button className={cn("text-white", primaryBtnClass)}>
                    Browse Tournaments
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {waitlist.map((entry) => (
                <Card key={entry.id} className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link
                            href={`/${sport}/tournaments/${entry.tournament.id}`}
                            className="font-medium text-gray-900 hover:underline"
                          >
                            {entry.tournament.name}
                          </Link>
                          {getStatusBadge(entry.status)}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(entry.tournament.startDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {entry.tournament.location}
                          </div>
                        </div>

                        {/* Position Info */}
                        <div className="flex items-center gap-4">
                          <div className={cn("px-3 py-1 rounded-full", primaryBgClass)}>
                            <span className={cn("font-bold", primaryTextClass)}>
                              {getPositionLabel(entry.position)}
                            </span>
                            <span className="text-gray-600 text-sm"> in line</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            <Users className="w-4 h-4 inline mr-1" />
                            {entry.totalWaitlist} on waitlist
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.spotsLeft === 0 ? (
                              <span className="text-amber-600">Tournament full</span>
                            ) : (
                              <span className="text-emerald-600">{entry.spotsLeft} spots left</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {entry.status === "WAITING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleLeaveWaitlist(entry.tournament.id)}
                          >
                            Leave Waitlist
                          </Button>
                        )}
                        <Link href={`/${sport}/tournaments/${entry.tournament.id}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            View Tournament
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Joined Date */}
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                      Joined waitlist on{" "}
                      {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
