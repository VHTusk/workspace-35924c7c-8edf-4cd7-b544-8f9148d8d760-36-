"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  Users,
  Calendar,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader2,
  Timer,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WaitlistEntry {
  id: string;
  position: number;
  status: string;
  joinedAt: string;
  promotedAt: string | null;
  promotionExpiresAt: string | null;
  tournament: {
    id: string;
    name: string;
    startDate: string;
    maxPlayers: number;
    registrationsCount: number;
  };
}

export default function WaitlistPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.id as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  useEffect(() => {
    fetchWaitlist();
  }, [tournamentId]);

  const fetchWaitlist = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/waitlist`);
      if (response.ok) {
        const data = await response.json();
        setWaitlistEntry(data.userEntry);
        setEntries(data.waitlist || []);
      }
    } catch (err) {
      setError("Failed to load waitlist");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to leave the waitlist?")) return;

    setCancelling(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/waitlist`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push(`/${sport}/tournaments/${tournamentId}`);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to cancel");
      }
    } catch (err) {
      setError("Failed to cancel waitlist entry");
    } finally {
      setCancelling(false);
    }
  };

  const handleAcceptPromotion = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/waitlist/promote`, {
        method: "POST",
      });

      if (response.ok) {
        router.push(`/${sport}/tournaments/${tournamentId}`);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to accept promotion");
      }
    } catch (err) {
      setError("Failed to accept promotion");
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Promoted state - show promotion acceptance
  if (waitlistEntry?.status === "PROMOTED" && waitlistEntry.promotionExpiresAt) {
    const timeRemaining = getTimeRemaining(waitlistEntry.promotionExpiresAt);
    const isExpired = timeRemaining === "Expired";

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-lg">
          <Link
            href={`/${sport}/tournaments/${tournamentId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tournament
          </Link>

          <Card className={cn(
            "border-2",
            isExpired ? "border-red-200 bg-red-50" : cn("border-emerald-200", primaryBgClass)
          )}>
            <CardHeader className="text-center">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                isExpired ? "bg-red-100" : "bg-emerald-100"
              )}>
                {isExpired ? (
                  <AlertCircle className="w-8 h-8 text-red-600" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {isExpired ? "Promotion Expired" : "You're In!"}
              </CardTitle>
              <CardDescription>
                {waitlistEntry.tournament.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isExpired ? (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    Your 24-hour promotion window has expired. The spot has been offered to the next person.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className="bg-emerald-50 border-emerald-200 text-emerald-700">
                    <Timer className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Time remaining:</strong> {timeRemaining}
                    </AlertDescription>
                  </Alert>

                  <p className="text-gray-600 text-center">
                    A spot has opened up! Confirm your registration before time runs out.
                  </p>

                  <Button
                    onClick={handleAcceptPromotion}
                    className={cn("w-full", primaryBtnClass)}
                  >
                    Confirm Registration
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full"
              >
                Decline Spot
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <Link
          href={`/${sport}/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tournament
        </Link>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Your Position Card */}
        {waitlistEntry && (
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className={cn("w-5 h-5", primaryTextClass)} />
                Your Waitlist Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-4xl font-bold text-gray-900">
                    #{waitlistEntry.position}
                  </div>
                  <p className="text-gray-500 text-sm">in line</p>
                </div>
                <div className="text-right">
                  <Badge className={cn(primaryBgClass, primaryTextClass)}>
                    {waitlistEntry.status}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    Joined {new Date(waitlistEntry.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Tournament starts: {new Date(waitlistEntry.tournament.startDate).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  <Users className="w-4 h-4 inline mr-1" />
                  {waitlistEntry.tournament.registrationsCount}/{waitlistEntry.tournament.maxPlayers} registered
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                {cancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserX className="w-4 h-4 mr-2" />
                )}
                Leave Waitlist
              </Button>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card className="bg-white border-gray-100 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>How Waitlist Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                  primaryBgClass, primaryTextClass
                )}>
                  1
                </span>
                <p className="text-gray-600">
                  When a spot opens up, the first person on the waitlist gets promoted.
                </p>
              </li>
              <li className="flex gap-3">
                <span className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                  primaryBgClass, primaryTextClass
                )}>
                  2
                </span>
                <p className="text-gray-600">
                  You'll have <strong>24 hours</strong> to confirm your registration.
                </p>
              </li>
              <li className="flex gap-3">
                <span className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                  primaryBgClass, primaryTextClass
                )}>
                  3
                </span>
                <p className="text-gray-600">
                  If you don't confirm in time, the spot goes to the next person.
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Other Waitlist Entries (if any visible) */}
        {entries.length > 1 && (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Waitlist Queue</CardTitle>
              <CardDescription>
                {entries.length} players waiting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {entries.slice(0, 10).map((entry, index) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded",
                      entry.id === waitlistEntry?.id ? cn(primaryBgClass) : "bg-gray-50"
                    )}
                  >
                    <span className="text-sm text-gray-600">
                      #{entry.position}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {entry.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not on Waitlist */}
        {!waitlistEntry && (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                You are not on the waitlist for this tournament.
              </p>
              <Link href={`/${sport}/tournaments/${tournamentId}`}>
                <Button className={primaryBtnClass}>
                  View Tournament
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
