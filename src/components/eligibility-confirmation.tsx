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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Lock,
  User,
  MapPin,
  Calendar,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tournament: {
    name: string;
    type: string;
    scope: string;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    ageMin?: number | null;
    ageMax?: number | null;
    gender?: string | null;
  };
  player: {
    firstName: string;
    lastName: string;
    gender?: string | null;
    dob?: Date | string | null;
    city?: string | null;
    district?: string | null;
    state?: string | null;
  };
  sport: string;
  loading?: boolean;
}

export function EligibilityConfirmation({
  isOpen,
  onClose,
  onConfirm,
  tournament,
  player,
  sport,
  loading = false,
}: EligibilityConfirmationProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";

  // Calculate age from DOB
  const calculateAge = (dob: Date | string | null | undefined): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(player.dob);

  const handleConfirm = () => {
    if (!confirmed) {
      setError("Please confirm your details before proceeding");
      return;
    }
    onConfirm();
  };

  const handleClose = () => {
    setConfirmed(false);
    setError("");
    onClose();
  };

  // Format location based on scope
  const getLocationDisplay = () => {
    switch (tournament.scope) {
      case "CITY":
        return tournament.city || player.city || "Not specified";
      case "DISTRICT":
        return tournament.district || player.district || "Not specified";
      case "STATE":
        return tournament.state || player.state || "Not specified";
      default:
        return "National";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className={cn("w-5 h-5", primaryTextClass)} />
            Confirm Your Entry Details
          </DialogTitle>
          <DialogDescription>
            Please review and confirm your information before registering
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
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500 mb-1">Tournament</p>
            <p className="font-medium text-gray-900">{tournament.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {tournament.scope}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {tournament.type.replace("_", " ")}
              </Badge>
            </div>
          </div>

          {/* Player Details */}
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Your Registration Details</p>
            
            <div className="space-y-3">
              {/* Name */}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">
                    {player.firstName} {player.lastName}
                  </p>
                </div>
              </div>

              {/* Gender */}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium text-gray-900">
                    {player.gender || "Not specified"}
                  </p>
                </div>
              </div>

              {/* Age */}
              {age && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Age</p>
                    <p className="font-medium text-gray-900">
                      {age} years old
                      {tournament.ageMin && tournament.ageMax && (
                        <span className="text-xs text-gray-500 ml-1">
                          (Required: {tournament.ageMin}-{tournament.ageMax})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">
                    {tournament.scope === "CITY" ? "City" : 
                     tournament.scope === "DISTRICT" ? "District" : 
                     tournament.scope === "STATE" ? "State" : "Location"}
                  </p>
                  <p className="font-medium text-gray-900">
                    {getLocationDisplay()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Lock Warning */}
          <Alert className={cn("border", primaryBgClass)}>
            <Lock className="w-4 h-4" />
            <AlertDescription className={primaryTextClass}>
              <strong>Important:</strong> This data will be locked after registration. 
              Make sure all details are correct before confirming.
            </AlertDescription>
          </Alert>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => {
                setConfirmed(checked as boolean);
                setError("");
              }}
            />
            <Label htmlFor="confirm" className="text-sm text-gray-600 leading-tight cursor-pointer">
              I confirm that the above details are correct and I am eligible to participate 
              in this tournament according to its requirements.
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !confirmed}
            className={cn(
              isCornhole 
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-teal-600 hover:bg-teal-700 text-white"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Registering...
              </>
            ) : (
              "Confirm & Register"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
