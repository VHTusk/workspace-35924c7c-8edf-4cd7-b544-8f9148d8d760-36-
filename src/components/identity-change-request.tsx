"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  AlertCircle,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithCsrf } from "@/lib/client-csrf";

type IdentityField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "dob"
  | "gender";

interface IdentityFieldOption {
  field: IdentityField;
  value: string;
  inputType?: "text" | "email" | "tel" | "date";
}

interface IdentityChangeRequestProps {
  isOpen: boolean;
  onClose: () => void;
  fieldOptions: IdentityFieldOption[];
  initialField?: IdentityField;
  sport: string;
  onSuccess: () => void;
}

const fieldLabels: Record<IdentityField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone Number",
  dob: "Date of Birth",
  gender: "Gender",
};

export function IdentityChangeRequest({
  isOpen,
  onClose,
  fieldOptions,
  initialField,
  sport,
  onSuccess,
}: IdentityChangeRequestProps) {
  const defaultField = useMemo(
    () => initialField ?? fieldOptions[0]?.field ?? "firstName",
    [fieldOptions, initialField],
  );
  const [selectedField, setSelectedField] = useState<IdentityField>(defaultField);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedField(defaultField);
      setNewValue("");
      setReason("");
      setError("");
    }
  }, [defaultField, isOpen]);

  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const currentOption = fieldOptions.find((option) => option.field === selectedField);
  const currentValue = currentOption?.value ?? "";

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
      const response = await fetchWithCsrf("/api/identity-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: selectedField,
          oldValue: currentValue,
          newValue: newValue.trim(),
          reason: reason.trim(),
          sport,
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
    setSelectedField(defaultField);
    setNewValue("");
    setReason("");
    setError("");
    onClose();
  };

  const inputType = currentOption?.inputType ?? (selectedField === "dob" ? "date" : "text");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Identity Change</DialogTitle>
          <DialogDescription>
            Send a locked-profile edit request to ValorHive management for review
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Field</Label>
            <Select value={selectedField} onValueChange={(value) => setSelectedField(value as IdentityField)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((option) => (
                  <SelectItem key={option.field} value={option.field}>
                    {fieldLabels[option.field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Value */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Current {fieldLabels[selectedField]}</p>
            <p className="font-medium text-gray-900">{currentValue || "Not set"}</p>
          </div>

          {/* New Value */}
          <div className="space-y-2">
            <Label htmlFor="newValue">New {fieldLabels[selectedField]}</Label>
            <Input
              id="newValue"
              type={inputType}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={`Enter new ${fieldLabels[selectedField]?.toLowerCase()}`}
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
