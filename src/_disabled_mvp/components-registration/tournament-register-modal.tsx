"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Trophy,
  Calendar,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PromoCodeInput } from "@/components/promo-code-input";

interface TournamentRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: {
    id: string;
    name: string;
    entryFee: number;
    startDate: string;
    location: string;
    sport: string;
  };
  onSuccess: () => void;
}

export function TournamentRegisterModal({
  open,
  onOpenChange,
  tournament,
  onSuccess,
}: TournamentRegisterModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
    discountText: string;
  } | null>(null);

  const originalAmount = tournament.entryFee * 100; // Convert to paise
  const displayAmount = promoDiscount?.finalAmount || originalAmount;

  const formatAmount = (amount: number) => `₹${(amount / 100).toLocaleString("en-IN")}`;

  const handleRegister = async () => {
    setIsRegistering(true);
    setError(null);

    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoCode: promoDiscount?.code,
          finalAmount: displayAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // If payment is required, Razorpay will be handled by the parent component
      if (data.requiresPayment) {
        // Emit payment details for parent to handle
        onSuccess(data);
        onOpenChange(false);
        return;
      }

      // Free tournament - success
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setError("Failed to register. Please try again.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleClose = () => {
    if (!isRegistering) {
      setError(null);
      setSuccess(false);
      setPromoDiscount(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Tournament Registration
          </DialogTitle>
          <DialogDescription>
            Complete your registration for {tournament.name}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Registration Complete!</h3>
            <p className="text-gray-500 mt-1">You have been registered successfully.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tournament Info */}
            <Card className="bg-gray-50 border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{tournament.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(tournament.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{tournament.location}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Promo Code Input */}
            {tournament.entryFee > 0 && (
              <PromoCodeInput
                sport={tournament.sport.toUpperCase()}
                usedFor="TOURNAMENT_ENTRY"
                referenceId={tournament.id}
                orderAmount={originalAmount}
                onDiscountApplied={(discount) => {
                  setPromoDiscount(discount);
                }}
                onDiscountRemoved={() => {
                  setPromoDiscount(null);
                }}
                disabled={isRegistering}
              />
            )}

            {/* Payment Summary */}
            {tournament.entryFee > 0 && (
              <div className="space-y-2">
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Entry Fee</span>
                  <span className={promoDiscount ? "line-through text-gray-400" : "text-gray-900"}>
                    {formatAmount(originalAmount)}
                  </span>
                </div>
                {promoDiscount && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount Applied</span>
                    <span>-{formatAmount(promoDiscount.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t">
                  <span>Amount to Pay</span>
                  <span className={promoDiscount ? "text-green-600" : ""}>
                    {formatAmount(displayAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Register Button */}
            <Button
              className={cn("w-full gap-2", tournament.entryFee === 0 ? "bg-green-600 hover:bg-green-700" : "")}
              onClick={handleRegister}
              disabled={isRegistering}
              size="lg"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : tournament.entryFee === 0 ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Register (Free)
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pay {formatAmount(displayAmount)}
                </>
              )}
            </Button>

            {tournament.entryFee > 0 && (
              <p className="text-xs text-center text-gray-500">
                Secure payment powered by Razorpay
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
