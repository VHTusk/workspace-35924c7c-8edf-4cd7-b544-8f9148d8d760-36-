"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Image,
  Loader2,
  Send,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  playedAt: string;
  opponent: {
    firstName: string;
    lastName: string;
  };
  tournament: {
    name: string;
  } | null;
  scoreA: number;
  scoreB: number;
  outcome: string;
  winnerId: string | null;
}

export default function NewDisputePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const matchIdParam = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('match');
  
  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>(matchIdParam || "");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");

  useEffect(() => {
    fetchRecentMatches();
  }, []);

  const fetchRecentMatches = async () => {
    try {
      const response = await fetch("/api/player/matches?limit=20");
      if (response.ok) {
        const data = await response.json();
        // Filter matches within 2-hour window
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const disputableMatches = (data.matches || []).filter((m: Match) => {
          const playedAt = new Date(m.playedAt);
          return playedAt >= twoHoursAgo && m.outcome !== 'BYE';
        });
        setMatches(disputableMatches);
      }
    } catch (err) {
      setError("Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedMatch = () => {
    return matches.find(m => m.id === selectedMatchId);
  };

  const getTimeRemaining = (playedAt: string) => {
    const played = new Date(playedAt);
    const deadline = new Date(played.getTime() + 2 * 60 * 60 * 1000);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes} min remaining`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m remaining`;
  };

  const handleSubmit = async () => {
    if (!selectedMatchId) {
      setError("Please select a match");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for the dispute");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: selectedMatchId,
          reason: reason.trim(),
          evidence: evidence.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit dispute");
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError("Failed to submit dispute");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-lg">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Dispute Submitted</h2>
              <p className="text-gray-600 mb-4">
                Your dispute has been submitted for review. You'll be notified when there's an update.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href={`/${sport}/disputes`}>
                  <Button variant="outline">View My Disputes</Button>
                </Link>
                <Link href={`/${sport}/dashboard`}>
                  <Button className={primaryBtnClass}>Back to Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedMatch = getSelectedMatch();

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <Link
          href={`/${sport}/dashboard`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Submit a Dispute</h1>
        <p className="text-gray-500 mb-6">
          Disputes can only be submitted within 2 hours of match completion
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Time Window Info */}
        <Alert className="bg-amber-50 border-amber-200 text-amber-700 mb-6">
          <Clock className="w-4 h-4" />
          <AlertDescription>
            <strong>2-Hour Window:</strong> Disputes must be submitted within 2 hours of match completion. 
            After that, results are final.
          </AlertDescription>
        </Alert>

        {matches.length === 0 ? (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No matches available for dispute</p>
              <p className="text-sm text-gray-500 mt-1">
                Matches can only be disputed within 2 hours of completion
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Match Selection */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>Select Match</CardTitle>
                <CardDescription>
                  Choose the match you want to dispute
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    onClick={() => setSelectedMatchId(match.id)}
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      selectedMatchId === match.id
                        ? isCornhole
                          ? "border-green-500 bg-green-50"
                          : "border-teal-500 bg-teal-50"
                        : "border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        vs {match.opponent.firstName} {match.opponent.lastName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getTimeRemaining(match.playedAt)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{match.tournament?.name || "Friendly Match"}</span>
                      <span className="font-medium">
                        Score: {match.scoreA} - {match.scoreB}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Dispute Form */}
            {selectedMatch && (
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle>Dispute Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-gray-700">
                      Reason for Dispute *
                    </Label>
                    <Textarea
                      id="reason"
                      placeholder="Explain why you believe the result is incorrect..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      className="border-gray-200"
                    />
                  </div>

                  {/* Evidence */}
                  <div className="space-y-2">
                    <Label htmlFor="evidence" className="text-gray-700">
                      Additional Evidence (Optional)
                    </Label>
                    <Textarea
                      id="evidence"
                      placeholder="Provide any additional details or context..."
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      rows={2}
                      className="border-gray-200"
                    />
                    <p className="text-xs text-gray-500">
                      Photo evidence can be submitted after the dispute is created
                    </p>
                  </div>

                  {/* Warning */}
                  <Alert className="bg-gray-50 border-gray-200">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <AlertDescription className="text-gray-600">
                      False disputes may result in penalties. Only submit disputes when you have 
                      legitimate concerns about the match result.
                    </AlertDescription>
                  </Alert>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !reason.trim()}
                    className={cn("w-full", primaryBtnClass)}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Dispute
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
