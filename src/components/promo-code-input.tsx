"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Ticket,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PromoCodeInputProps {
  sport: string;
  usedFor: "SUBSCRIPTION" | "TOURNAMENT_ENTRY";
  referenceId: string;
  orderAmount: number; // in paise
  onDiscountApplied?: (discount: {
    code: string;
    discountAmount: number;
    finalAmount: number;
    discountText: string;
  }) => void;
  onDiscountRemoved?: () => void;
  disabled?: boolean;
  className?: string;
}

interface ValidationResult {
  valid: boolean;
  promoCode?: {
    code: string;
    discountType: string;
    discountValue: number;
  };
  calculation?: {
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    maxDiscountApplied: boolean;
  };
  discountText?: string;
  error?: string;
}

export function PromoCodeInput({
  sport,
  usedFor,
  referenceId,
  orderAmount,
  onDiscountApplied,
  onDiscountRemoved,
  disabled = false,
  className,
}: PromoCodeInputProps) {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isApplied, setIsApplied] = useState(false);

  const handleValidate = async () => {
    if (!code.trim()) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          sport,
          usedFor,
          referenceId,
          orderAmount,
        }),
      });

      const data = await response.json();
      setValidationResult(data);

      if (data.valid && data.calculation) {
        setIsApplied(true);
        onDiscountApplied?.({
          code: data.promoCode.code,
          discountAmount: data.calculation.discountAmount,
          finalAmount: data.calculation.finalAmount,
          discountText: data.discountText,
        });
      }
    } catch (error) {
      console.error("Error validating promo code:", error);
      setValidationResult({
        valid: false,
        error: "Failed to validate promo code. Please try again.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setCode("");
    setValidationResult(null);
    setIsApplied(false);
    onDiscountRemoved?.();
  };

  const formatAmount = (amount: number) => {
    return `₹${(amount / 100).toFixed(0)}`;
  };

  // If discount is applied, show applied state
  if (isApplied && validationResult?.valid) {
    return (
      <Card className={cn("border-green-500/30 bg-green-500/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {validationResult.promoCode?.code}
                  </span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    Applied
                  </Badge>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {validationResult.discountText}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>

          {/* Price Summary */}
          <div className="mt-3 pt-3 border-t border-green-500/20">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Price</span>
              <span className="line-through text-muted-foreground">
                {formatAmount(orderAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatAmount(validationResult.calculation?.discountAmount || 0)}</span>
            </div>
            <div className="flex justify-between font-semibold text-green-700 dark:text-green-300 mt-1 pt-1 border-t border-green-500/20">
              <span>Final Price</span>
              <span>{formatAmount(validationResult.calculation?.finalAmount || orderAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Ticket className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Have a promo code?</span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Enter promo code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setValidationResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleValidate();
            }
          }}
          disabled={disabled || isValidating}
          className={cn(
            "flex-1 uppercase",
            validationResult && !validationResult.valid && "border-red-500 focus-visible:ring-red-500",
            validationResult?.valid && "border-green-500 focus-visible:ring-green-500"
          )}
        />
        <Button
          onClick={handleValidate}
          disabled={disabled || isValidating || !code.trim()}
          variant="outline"
          className="shrink-0"
        >
          {isValidating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1" />
              Apply
            </>
          )}
        </Button>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm",
            validationResult.valid
              ? "bg-green-500/10 text-green-600 border border-green-500/30"
              : "bg-red-500/10 text-red-600 border border-red-500/30"
          )}
        >
          {validationResult.valid ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{validationResult.discountText}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{validationResult.error || "Invalid promo code"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
