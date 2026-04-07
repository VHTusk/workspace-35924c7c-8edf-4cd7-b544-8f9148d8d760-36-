"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Users,
  Trophy,
} from "lucide-react";

interface Dispute {
  id: string;
  matchId: string;
  sport: string;
  status: string;
  reason: string;
  evidence?: string;
  resolution?: string;
  resolvedById?: string;
  resolvedAt?: string;
  createdAt: string;
  raisedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Match {
  id: string;
  tournament: {
    id: string;
    name: string;
  } | null;
  playerA: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    elo: number;
  };
  playerB: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    elo: number;
  } | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  outcome: string | null;
  playedAt: string;
  verificationStatus: string;
  round?: string;
}

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const disputeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [resolution, setResolution] = useState("");
  const [newScoreA, setNewScoreA] = useState<string>("");
  const [newScoreB, setNewScoreB] = useState<string>("");
  const [newWinnerId, setNewWinnerId] = useState<string>("");

  useEffect(() => {
    fetchDispute();
  }, [disputeId]);

  const fetchDispute = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/disputes/${disputeId}`);
      if (response.ok) {
        const data = await response.json();
        setDispute(data.dispute);
        setMatch(data.match);
        
        // Pre-fill current scores
        if (data.match) {
          setNewScoreA(data.match.scoreA?.toString() || "");
          setNewScoreB(data.match.scoreB?.toString() || "");
          setNewWinnerId(data.match.winnerId || "");
        }
      } else {
        setError("Dispute not found");
      }
    } catch (err) {
      setError("Failed to load dispute");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (approve: boolean) => {
    if (!resolution.trim()) {
      setError("Please provide a resolution explanation");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const body: {
        resolution: string;
        newScoreA?: number;
        newScoreB?: number;
        newWinnerId?: string;
      } = { resolution };

      // Include score changes if provided
      if (newScoreA !== "" && newScoreB !== "") {
        body.newScoreA = parseInt(newScoreA);
        body.newScoreB = parseInt(newScoreB);
        body.newWinnerId = newWinnerId || undefined;
      }

      const response = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to resolve dispute");
        return;
      }

      setSuccess("Dispute resolved successfully");
      setTimeout(() => {
        router.push(`/${sport}/admin`);
      }, 2000);
    } catch (err) {
      setError("Failed to resolve dispute");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="py-8 px-4">
        <div className="container mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error || "Dispute not found"}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-red-500/10 text-red-400";
      case "REVIEWING":
        return "bg-amber-500/10 text-amber-400";
      case "RESOLVED":
        return "bg-emerald-500/10 text-emerald-400";
      default:
        return "bg-gray-500/10 text-gray-400";
    }
  };

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Back Button */}
        <Link href={`/${sport}/admin`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Dispute Header */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Dispute Details
                </CardTitle>
                <CardDescription>
                  Created: {new Date(dispute.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <Badge className={getStatusColor(dispute.status)}>
                {dispute.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Reason</Label>
                <p className="mt-1">{dispute.reason}</p>
              </div>
              {dispute.evidence && (
                <div>
                  <Label className="text-muted-foreground">Evidence</Label>
                  <p className="mt-1 text-sm">{dispute.evidence}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Raised By</Label>
                <p className="mt-1">
                  {dispute.raisedBy.firstName} {dispute.raisedBy.lastName} ({dispute.raisedBy.email})
                </p>
              </div>
              {dispute.resolution && (
                <div>
                  <Label className="text-muted-foreground">Resolution</Label>
                  <p className="mt-1">{dispute.resolution}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Match Details */}
        {match && (
          <Card className="bg-gradient-card border-border/50 mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Match Information</CardTitle>
              {match.tournament && (
                <CardDescription>
                  <Trophy className="w-4 h-4 inline mr-1" />
                  {match.tournament.name}
                  {match.round && ` • ${match.round}`}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 items-center">
                {/* Player A */}
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="font-medium">
                    {match.playerA.firstName} {match.playerA.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">ELO: {match.playerA.elo}</p>
                  {match.scoreA !== null && (
                    <p className="text-2xl font-bold mt-2">{match.scoreA}</p>
                  )}
                  {match.winnerId === match.playerA.id && (
                    <Badge className="mt-2 bg-emerald-500/10 text-emerald-400">Winner</Badge>
                  )}
                </div>

                {/* VS */}
                <div className="text-center">
                  <span className="text-lg text-muted-foreground font-bold">VS</span>
                </div>

                {/* Player B */}
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  {match.playerB ? (
                    <>
                      <p className="font-medium">
                        {match.playerB.firstName} {match.playerB.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">ELO: {match.playerB.elo}</p>
                      {match.scoreB !== null && (
                        <p className="text-2xl font-bold mt-2">{match.scoreB}</p>
                      )}
                      {match.winnerId === match.playerB.id && (
                        <Badge className="mt-2 bg-emerald-500/10 text-emerald-400">Winner</Badge>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">TBD</p>
                  )}
                </div>
              </div>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                Match ID: {match.id.slice(-8)} • Played: {new Date(match.playedAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resolution Form */}
        {dispute.status !== "RESOLVED" && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Resolve Dispute</CardTitle>
              <CardDescription>
                Provide a resolution and optionally correct the match scores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution Explanation *</Label>
                <Textarea
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Explain the resolution decision..."
                  rows={3}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Correct Scores (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {match?.playerA.firstName}'s Score
                    </Label>
                    <Input
                      type="number"
                      value={newScoreA}
                      onChange={(e) => setNewScoreA(e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {match?.playerB?.firstName}'s Score
                    </Label>
                    <Input
                      type="number"
                      value={newScoreB}
                      onChange={(e) => setNewScoreB(e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                {newScoreA !== "" && newScoreB !== "" && match?.playerB && (
                  <div className="mt-4 space-y-2">
                    <Label>Winner</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={newWinnerId === match.playerA.id ? "default" : "outline"}
                        onClick={() => setNewWinnerId(match.playerA.id)}
                        className="flex-1"
                      >
                        {match.playerA.firstName} {match.playerA.lastName}
                      </Button>
                      {match.playerB && (
                        <Button
                          type="button"
                          variant={newWinnerId === match.playerB.id ? "default" : "outline"}
                          onClick={() => match.playerB && setNewWinnerId(match.playerB.id)}
                          className="flex-1"
                        >
                          {match.playerB.firstName} {match.playerB.lastName}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => handleResolve(true)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Resolve Dispute
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
