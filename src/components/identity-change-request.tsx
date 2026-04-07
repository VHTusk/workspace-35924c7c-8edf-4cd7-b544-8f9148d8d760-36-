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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IdentityChangeRequestProps {
  isOpen: boolean;
  onClose: () => void;
  currentField: "firstName" | "lastName" | "dob" | "gender" | "city" | "state";
  currentValue: string;
  sport: string;
  onSuccess: () => void;
}

const fieldLabels: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  dob: "Date of Birth",
  gender: "Gender",
  city: "City",
  state: "State",
};

export function IdentityChangeRequest({
  isOpen,
  onClose,
  currentField,
  currentValue,
  sport,
  onSuccess,
}: IdentityChangeRequestProps) {
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const handleSubmit = async () => {
    if (!newValue.trim()) {
      setError("Please enter a new value");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for the change");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/identity-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: currentField,
          oldValue: currentValue,
          newValue: newValue.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit request");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewValue("");
    setReason("");
    setError("");
    onClose();
  };

  const inputType = currentField === "dob" ? "date" : "text";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Identity Change</DialogTitle>
          <DialogDescription>
            Request to change your {fieldLabels[currentField]?.toLowerCase() || currentField}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Value */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Current {fieldLabels[currentField]}</p>
            <p className="font-medium text-gray-900">{currentValue || "Not set"}</p>
          </div>

          {/* New Value */}
          <div className="space-y-2">
            <Label htmlFor="newValue">New {fieldLabels[currentField]}</Label>
            <Input
              id="newValue"
              type={inputType}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`Enter new ${fieldLabels[currentField]?.toLowerCase()}`}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Legal name change, correction of typo..."
              rows={3}
            />
          </div>

          {/* Warning */}
          <Alert className="bg-amber-50 border-amber-200 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Identity changes require admin approval and may require supporting documentation.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className={primaryBtnClass}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
