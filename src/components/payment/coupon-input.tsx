'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tag, Check, X, Loader2 } from 'lucide-react';

interface CouponInputProps {
  productId: string; // Tournament ID or "membership"
  productType: 'tournament' | 'membership';
  originalAmount: number; // Amount in paise
  onCouponApplied: (discount: {
    couponId: string;
    couponCode: string;
    discountAmount: number;
    finalAmount: number;
    discountType: string;
  }) => void;
  onCouponRemoved: () => void;
}

interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discountAmount: number;
  finalAmount: number;
  discountType: string;
}

// Helper to format paise to rupees
const formatCurrency = (paise: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
};

export function CouponInput({
  productId,
  productType,
  originalAmount,
  onCouponApplied,
  onCouponRemoved,
}: CouponInputProps) {
  const [couponCode, setCouponCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          productId,
          productType,
          originalAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate coupon');
      }

      if (data.valid) {
        const couponData: AppliedCoupon = {
          couponId: data.couponId,
          couponCode: data.couponCode,
          discountAmount: data.discountAmount,
          finalAmount: data.finalAmount,
          discountType: data.discountType,
        };

        setAppliedCoupon(couponData);
        setSuccess('Coupon Applied Successfully');
        onCouponApplied(couponData);
        setCouponCode('');
      } else {
        setError(data.error || 'Invalid coupon code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply coupon');
    } finally {
      setIsLoading(false);
    }
  }, [couponCode, productId, productType, originalAmount, onCouponApplied]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setSuccess(null);
    setError(null);
    onCouponRemoved();
  }, [onCouponRemoved]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !isLoading && !appliedCoupon) {
        handleApplyCoupon();
      }
    },
    [handleApplyCoupon, isLoading, appliedCoupon]
  );

  // Show applied coupon state
  if (appliedCoupon) {
    return (
      <div className="space-y-4">
        {/* Applied Coupon Badge */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800">
                  <Tag className="w-3 h-3 mr-1" />
                  {appliedCoupon.couponCode}
                </Badge>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Applied
                </span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                {appliedCoupon.discountType === 'PERCENTAGE'
                  ? `${appliedCoupon.discountAmount > 0 ? `${((appliedCoupon.discountAmount / originalAmount) * 100).toFixed(0)}% off` : 'Discount applied'}`
                  : 'Fixed discount applied'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveCoupon}
            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Remove coupon</span>
          </Button>
        </div>

        {/* Discount Breakdown */}
        <div className="p-4 rounded-lg border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-3">Price Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Original Price</span>
              <span>{formatCurrency(originalAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Coupon Discount</span>
              <span>-{formatCurrency(appliedCoupon.discountAmount)}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between font-semibold text-foreground">
              <span>Final Amount</span>
              <span>{formatCurrency(appliedCoupon.finalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show input state
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="pl-10 pr-4 uppercase tracking-wide placeholder:normal-case"
            maxLength={20}
          />
        </div>
        <Button
          onClick={handleApplyCoupon}
          disabled={isLoading || !couponCode.trim()}
          className="sm:w-auto w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Applying...</span>
            </>
          ) : (
            'Apply'
          )}
        </Button>
      </div>

      {/* Success Message */}
      {success && (
        <Alert variant="success" className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default CouponInput;
