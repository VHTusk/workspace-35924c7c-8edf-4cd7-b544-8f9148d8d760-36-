"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Loader2,
  Send,
  Clock,
  Upload,
  X,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Dispute reason enum values
const DISPUTE_REASONS = [
  { value: "SCORE_ENTRY_ERROR", label: "Score Entry Error", description: "The score was entered incorrectly" },
  { value: "WRONG_WINNER_RECORDED", label: "Wrong Winner Recorded", description: "The wrong player was marked as winner" },
  { value: "OPPONENT_NO_SHOW", label: "Opponent No-Show", description: "Opponent didn't show but match was marked as played" },
  { value: "RULE_VIOLATION", label: "Rule Violation", description: "Opponent violated tournament rules" },
  { value: "EQUIPMENT_ISSUE", label: "Equipment Issue", description: "There was an equipment problem affecting the match" },
  { value: "OTHER", label: "Other", description: "Other reason (please describe)" },
];

interface Match {
  id: string;
  playedAt: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  outcome: string | null;
  opponent: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  tournament: {
    id: string;
    name: string;
  } | null;
  timeRemaining: number;
  hasDispute: boolean;
}

interface DisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match | null;
  userId: string;
  sport: string;
  onSuccess?: () => void;
}

export function DisputeModal({
  open,
  onOpenChange,
  match,
  userId,
  sport,
  onSuccess,
}: DisputeModalProps) {
  const router = useRouter();
  const isCornhole = sport === "cornhole";
  
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setReason("");
      setDescription("");
      setEvidenceUrls([]);
      setNewEvidenceUrl("");
      setError("");
      setSuccess(false);
    }
  }, [open]);

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Expired";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const handleAddEvidence = () => {
    if (newEvidenceUrl.trim() && !evidenceUrls.includes(newEvidenceUrl.trim())) {
      setEvidenceUrls([...evidenceUrls, newEvidenceUrl.trim()]);
      setNewEvidenceUrl("");
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!match) return;
    if (!reason) {
      setError("Please select a reason for the dispute");
      return;
    }
    if (reason === "OTHER" && !description.trim()) {
      setError("Please provide a description for 'Other' reason");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          reason,
          description: description.trim() || undefined,
          evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit dispute");
        return;
      }

      setSuccess(true);
      
      // Call onSuccess callback after a short delay
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError("Failed to submit dispute. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!match) return null;

  // Determine if current user won or lost
  const isWinner = match.winnerId === userId;
  const isLoser = match.winnerId && !isWinner;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispute Match Result</DialogTitle>
          <DialogDescription>
            Submit a dispute for your match. Disputes must be made within 72 hours of match completion.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dispute Submitted</h3>
            <p className="text-gray-600 text-sm">
              Your dispute has been submitted for review. You will be notified when there is an update.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Match Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  vs {match.opponent?.firstName} {match.opponent?.lastName}
                </span>
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTimeRemaining(match.timeRemaining)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{match.tournament?.name || "Friendly Match"}</span>
                <span className="font-medium">
                  Score: {match.scoreA} - {match.scoreB}
                </span>
              </div>
              {isWinner && (
                <p className="text-xs text-emerald-600 font-medium">You won this match</p>
              )}
              {isLoser && (
                <p className="text-xs text-gray-500">You lost this match</p>
              )}
            </div>

            {/* Time Warning */}
            {match.timeRemaining < 6 * 60 * 60 * 1000 && (
              <Alert className="bg-amber-50 border-amber-200">
                <Clock className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Dispute window closes soon! Only {formatTimeRemaining(match.timeRemaining)} left.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Reason Selection */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Dispute *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {DISPUTE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-gray-500">{r.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Additional Details
                {reason === "OTHER" && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                id="description"
                placeholder="Please provide more details about the dispute..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Evidence URLs */}
            <div className="space-y-2">
              <Label>Photo Evidence (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter image URL..."
                  value={newEvidenceUrl}
                  onChange={(e) => setNewEvidenceUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEvidence();
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddEvidence}
                  disabled={!newEvidenceUrl.trim()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              {evidenceUrls.length > 0 && (
                <div className="space-y-2 mt-2">
                  {evidenceUrls.map((url, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-100 rounded p-2">
                      <span className="text-xs text-gray-600 truncate flex-1">{url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveEvidence(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warning */}
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                False disputes may result in penalties. Only submit legitimate disputes.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !reason}
                className={primaryBtnClass}
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
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
