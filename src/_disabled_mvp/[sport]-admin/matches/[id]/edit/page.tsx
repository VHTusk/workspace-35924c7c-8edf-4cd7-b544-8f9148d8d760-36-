"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  History,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchData {
  id: string;
  scoreA: number | null;
  scoreB: number | null;
  outcome: string;
  outcomeReason: string | null;
  winnerId: string | null;
  pointsA: number | null;
  pointsB: number | null;
  eloChangeA: number | null;
  eloChangeB: number | null;
  playerA: { id: string; firstName: string; lastName: string; hiddenElo: number };
  playerB: { id: string; firstName: string; lastName: string; hiddenElo: number } | null;
  tournament: { id: string; name: string; scope: string } | null;
  hasDownstreamMatches: boolean;
  downstreamMatchCount: number;
}

interface HistoryEntry {
  id: string;
  oldScoreA: number | null;
  oldScoreB: number | null;
  oldOutcome: string;
  newScoreA: number | null;
  newScoreB: number | null;
  newOutcome: string;
  reason: string;
  createdAt: string;
  actor: { firstName: string; lastName: string } | null;
}

const outcomeOptions = [
  { value: "PLAYED", label: "Normal Match Completed", requiresScore: true },
  { value: "WALKOVER", label: "Walkover", requiresScore: false },
  { value: "NO_SHOW", label: "No Show", requiresScore: false },
  { value: "FORFEIT", label: "Forfeit", requiresScore: false },
  { value: "BYE", label: "Bye", requiresScore: false },
];

export default function MatchEditPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const matchId = params.id as string;

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [match, setMatch] = useState<MatchData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [outcome, setOutcome] = useState("");
  const [outcomeReason, setOutcomeReason] = useState("");
  const [editReason, setEditReason] = useState("");

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const fetchMatch = async () => {
    try {
      const response = await fetch(`/api/admin/matches/${matchId}`);
      if (response.ok) {
        const data = await response.json();
        setMatch(data.match);
        setHistory(data.history || []);
        setScoreA(data.match.scoreA?.toString() || "");
        setScoreB(data.match.scoreB?.toString() || "");
        setOutcome(data.match.outcome || "PLAYED");
        setOutcomeReason(data.match.outcomeReason || "");
      } else {
        setError("Match not found");
      }
    } catch (err) {
      setError("Failed to load match");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editReason.trim()) {
      setError("Please provide a reason for this change");
      return;
    }

    if (outcome === "PLAYED" && (!scoreA || !scoreB)) {
      setError("Please enter scores for played match");
      return;
    }

    if (["WALKOVER", "NO_SHOW", "FORFEIT"].includes(outcome) && !outcomeReason.trim()) {
      setError("Please provide a reason for this outcome");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/matches/${matchId}/result`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreA: outcome === "PLAYED" ? parseInt(scoreA) : null,
          scoreB: outcome === "PLAYED" ? parseInt(scoreB) : null,
          outcome,
          outcomeReason: outcomeReason.trim() || null,
          reason: editReason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update match");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/${sport}/admin/matches`);
      }, 2000);
    } catch (err) {
      setError("Failed to update match");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md bg-white border-gray-100 shadow-sm">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Match Updated</h2>
            <p className="text-gray-600">Redirecting to matches list...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error || "Match not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectedOutcome = outcomeOptions.find(o => o.value === outcome);
  const winnerId = outcome === "PLAYED" && scoreA && scoreB
    ? (parseInt(scoreA) > parseInt(scoreB) ? match.playerA.id : match.playerB?.id)
    : outcome === "BYE" ? match.playerA.id : null;

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <Link
          href={`/${sport}/admin/matches`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Matches
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Match Result</h1>
        <p className="text-gray-500 mb-6">
          {match.tournament?.name || "Friendly Match"} • Match ID: {matchId.slice(-8)}
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Cascade Warning */}
        {match.hasDownstreamMatches && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-700 mb-6">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Cascade Warning:</strong> This match has {match.downstreamMatchCount} downstream 
              match(es). Editing this result may require a cascade reset.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Players */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>Match Players</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="font-medium text-gray-900">
                      {match.playerA.firstName} {match.playerA.lastName}
                    </p>
                    <p className="text-xs text-gray-500">Elo: {Math.round(match.playerA.hiddenElo)}</p>
                  </div>
                  <div className="text-gray-400 font-bold">VS</div>
                  <div className="text-center">
                    {match.playerB ? (
                      <>
                        <p className="font-medium text-gray-900">
                          {match.playerB.firstName} {match.playerB.lastName}
                        </p>
                        <p className="text-xs text-gray-500">Elo: {Math.round(match.playerB.hiddenElo)}</p>
                      </>
                    ) : (
                      <p className="text-gray-400">TBD / Bye</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score Edit */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>Result Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Outcome */}
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {outcomeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Scores (if PLAYED) */}
                {outcome === "PLAYED" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{match.playerA.firstName}'s Score</Label>
                      <Input
                        type="number"
                        value={scoreA}
                        onChange={(e) => setScoreA(e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{match.playerB?.firstName || "Opponent"}'s Score</Label>
                      <Input
                        type="number"
                        value={scoreB}
                        onChange={(e) => setScoreB(e.target.value)}
                        min="0"
                      />
                    </div>
                  </div>
                )}

                {/* Outcome Reason */}
                {["WALKOVER", "NO_SHOW", "FORFEIT"].includes(outcome) && (
                  <div className="space-y-2">
                    <Label>Reason for {outcome.replace("_", " ")}</Label>
                    <Textarea
                      value={outcomeReason}
                      onChange={(e) => setOutcomeReason(e.target.value)}
                      placeholder="e.g., Player did not arrive on time..."
                      rows={2}
                    />
                  </div>
                )}

                {/* Winner Preview */}
                {outcome === "PLAYED" && scoreA && scoreB && (
                  <div className={cn(
                    "p-3 rounded-lg",
                    parseInt(scoreA) > parseInt(scoreB) ? "bg-green-50" :
                    parseInt(scoreB) > parseInt(scoreA) ? "bg-blue-50" : "bg-gray-50"
                  )}>
                    <p className="text-sm text-gray-600">
                      Winner: <strong>
                        {parseInt(scoreA) > parseInt(scoreB)
                          ? `${match.playerA.firstName} ${match.playerA.lastName}`
                          : parseInt(scoreB) > parseInt(scoreA)
                            ? `${match.playerB?.firstName} ${match.playerB?.lastName}`
                            : "Tie (not allowed)"}
                      </strong>
                    </p>
                  </div>
                )}

                <Separator />

                {/* Edit Reason */}
                <div className="space-y-2">
                  <Label>Reason for Edit *</Label>
                  <Textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g., Score entry error, correcting typo..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Link href={`/${sport}/admin/matches/${matchId}/rollback`}>
                <Button variant="outline" className="text-red-600 border-red-200">
                  Cascade Reset (Level 2)
                </Button>
              </Link>
              <Button
                onClick={handleSave}
                disabled={saving}
                className={primaryBtnClass}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Values */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Current Values</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Score</span>
                  <span className="font-medium">
                    {match.scoreA} - {match.scoreB}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outcome</span>
                  <Badge variant="outline">{match.outcome}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Points Awarded</span>
                  <span className="font-medium">
                    {match.pointsA} / {match.pointsB}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Elo Change</span>
                  <div className="flex gap-2">
                    <span className={cn(
                      "flex items-center",
                      (match.eloChangeA || 0) >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {(match.eloChangeA || 0) >= 0 ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {match.eloChangeA?.toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit History */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Edit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">No edits yet</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry, index) => (
                      <div key={entry.id} className="text-xs border-b pb-2 last:border-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-600">
                            {entry.actor?.firstName || "System"}
                          </span>
                          <span className="text-gray-400">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-500">{entry.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
