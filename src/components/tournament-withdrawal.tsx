"use client";

import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  IndianRupee,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentWithdrawalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
  startDate: string;
  entryFee: number;
  sport: string;
  onSuccess: () => void;
}

type RefundTier = "full" | "partial" | "none";

export function TournamentWithdrawal({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
  startDate,
  entryFee,
  sport,
  onSuccess,
}: TournamentWithdrawalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  // Calculate refund based on time
  const calculateRefund = (): { tier: RefundTier; amount: number; hoursUntil: number } => {
    const now = new Date();
    const start = new Date(startDate);
    const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil > 48) {
      return { tier: "full", amount: entryFee, hoursUntil };
    } else if (hoursUntil > 24) {
      return { tier: "partial", amount: Math.floor(entryFee * 0.5), hoursUntil };
    } else {
      return { tier: "none", amount: 0, hoursUntil };
    }
  };

  const refund = calculateRefund();

  const getRefundBadge = () => {
    switch (refund.tier) {
      case "full":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            100% Refund
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            50% Refund
          </Badge>
        );
      case "none":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            No Refund
          </Badge>
        );
    }
  };

  const handleWithdraw = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to withdraw");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to withdraw from tournament");
    } finally {
      setLoading(false);
    }
  };

  const formatHoursRemaining = () => {
    if (refund.hoursUntil < 1) {
      return "Less than 1 hour";
    } else if (refund.hoursUntil < 24) {
      return `${Math.floor(refund.hoursUntil)} hours`;
    } else {
      const days = Math.floor(refund.hoursUntil / 24);
      return `${days} day${days > 1 ? "s" : ""}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Withdraw from Tournament
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to withdraw from {tournamentName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Time Until Tournament */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Time until start:</span>
            </div>
            <span className="font-medium text-gray-900">
              {formatHoursRemaining()}
            </span>
          </div>

          {/* Refund Policy */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Refund Policy</span>
              {getRefundBadge()}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Entry fee paid:</span>
                <span className="font-medium">₹{entryFee.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Refund amount:</span>
                <span className={cn(
                  "font-bold text-lg",
                  refund.tier === "full" ? "text-emerald-600" :
                  refund.tier === "partial" ? "text-amber-600" : "text-red-600"
                )}>
                  ₹{refund.amount.toLocaleString()}
                </span>
              </div>
            </div>

            {refund.tier === "none" && (
              <Alert className="mt-3 bg-red-50 border-red-200 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Less than 24 hours before start - no refund available
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Refund Policy Info */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
            <p><strong>Refund Policy:</strong></p>
            <p>• 100% refund if withdrawn 48+ hours before</p>
            <p>• 50% refund if withdrawn 24-48 hours before</p>
            <p>• No refund if withdrawn less than 24 hours before</p>
          </div>

          {/* Reason (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-gray-700">
              Reason for withdrawal (optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g., Schedule conflict, medical emergency..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="border-gray-200"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Withdrawing...
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
