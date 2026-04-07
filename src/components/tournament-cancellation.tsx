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
  Users,
  DollarSign,
  Trophy,
  Loader2,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentCancellationProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: {
    id: string;
    name: string;
    registrationsCount: number;
    prizePool: number;
    status: string;
  };
  sport: string;
  onSuccess: () => void;
}

export function TournamentCancellation({
  isOpen,
  onClose,
  tournament,
  sport,
  onSuccess,
}: TournamentCancellationProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const handleCancel = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/tournaments/${tournament.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to cancel tournament");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to cancel tournament");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setError("");
    setStep(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Cancel Tournament
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please review the cascade effects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Tournament Info */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-medium text-red-900 mb-1">{tournament.name}</p>
            <Badge className="bg-red-100 text-red-700 border-red-200">
              {tournament.status}
            </Badge>
          </div>

          {/* Cascade Effects */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <p className="text-sm font-medium text-gray-700">Cancellation Cascade Effects</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Refunds */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto Refunds</p>
                  <p className="text-xs text-gray-500">
                    {tournament.registrationsCount} players will receive full refund within 7 days
                  </p>
                </div>
              </div>

              {/* Notifications */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Notifications Sent</p>
                  <p className="text-xs text-gray-500">
                    All registered players will be notified via email and in-app
                  </p>
                </div>
              </div>

              {/* Bracket Deletion */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Bracket Deleted</p>
                  <p className="text-xs text-gray-500">
                    All bracket data and match records will be removed
                  </p>
                </div>
              </div>

              {/* Points Reverted */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Points Reverted</p>
                  <p className="text-xs text-gray-500">
                    Any points awarded from this tournament will be reverted
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Warning:</strong> This will permanently cancel the tournament and 
              initiate automatic refunds to all registered players.
            </AlertDescription>
          </Alert>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-gray-700">
              Cancellation Reason *
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g., Insufficient registrations, venue unavailable, weather conditions..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="border-gray-200"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Keep Tournament
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading || !reason.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Tournament
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
