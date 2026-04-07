"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Ticket, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Trash2,
  Tag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CouponInputProps {
  sport: string;
  usageType: "SUBSCRIPTION" | "TOURNAMENT_REGISTRATION";
  referenceId?: string;
  originalAmount: number; // in paise
  onCouponApplied: (discount: number, couponId: string) => void;
  onCouponRemoved: () => void;
  disabled?: boolean;
}

interface CouponValidation {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    type: string;
    discountValue: number;
    maxDiscount?: number;
  };
  calculation?: {
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    discountFormatted: string;
  };
  error?: string;
}

export default function CouponInput({
  sport,
  usageType,
  referenceId,
  originalAmount,
  onCouponApplied,
  onCouponRemoved,
  disabled = false,
}: CouponInputProps) {
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation["coupon"] | null>(null);
  const [calculation, setCalculation] = useState<CouponValidation["calculation"] | null>(null);

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a coupon code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: couponCode,
          sport,
          usageType,
          referenceId,
          amount: originalAmount,
        }),
      });

      const data: CouponValidation = await response.json();

      if (data.valid && data.coupon && data.calculation) {
        setAppliedCoupon(data.coupon);
        setCalculation(data.calculation);
        onCouponApplied(data.calculation.discountAmount, data.coupon.id);
        toast({
          title: "Coupon Applied!",
          description: data.calculation.discountFormatted,
        });
      } else {
        toast({
          title: "Invalid Coupon",
          description: data.error || "This coupon code is not valid",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating coupon:", error);
      toast({
        title: "Error",
        description: "Failed to validate coupon. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    setCalculation(null);
    onCouponRemoved();
    toast({
      title: "Coupon Removed",
      description: "The coupon has been removed",
    });
  };

  const formatAmount = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  if (appliedCoupon && calculation) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-800 dark:text-green-200">
                  {appliedCoupon.code}
                </span>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200">
                  Applied
                </Badge>
              </div>
              <p className="text-sm text-green-600 dark:text-green-300">
                {calculation.discountFormatted}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeCoupon}
            disabled={disabled}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Original Amount</span>
            <span className="text-gray-500 line-through">{formatAmount(calculation.originalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-green-600 dark:text-green-400">Discount</span>
            <span className="text-green-600 dark:text-green-400">-{formatAmount(calculation.discountAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-green-200 dark:border-green-700">
            <span>Final Amount</span>
            <span className="text-green-700 dark:text-green-300">{formatAmount(calculation.finalAmount)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Tag className="w-4 h-4" />
        <span>Have a coupon code?</span>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="pl-10 uppercase"
            disabled={disabled || loading}
          />
        </div>
        <Button
          variant="outline"
          onClick={validateCoupon}
          disabled={disabled || loading || !couponCode.trim()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </div>
  );
}
