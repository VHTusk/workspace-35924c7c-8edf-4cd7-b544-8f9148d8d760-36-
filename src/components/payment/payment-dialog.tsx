'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CouponInput } from '@/components/payment/coupon-input';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  Loader2,
  Check,
  AlertCircle,
  Tag,
  ShieldCheck,
} from 'lucide-react';

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productType: 'tournament' | 'membership';
  productId: string;
  productName: string;
  originalAmount: number; // in paise
  sport?: 'cornhole' | 'darts';
  onSuccess: () => void;
  onCancel: () => void;
}

interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discountAmount: number;
  finalAmount: number;
  discountType: string;
}

interface PaymentOrderResponse {
  order: {
    id: string;
    amount: number;
    currency: string;
  };
  payer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  keyId: string;
  amountDisplay: string;
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

// Payment status type
type PaymentStatus = 'idle' | 'loading' | 'processing' | 'success' | 'error';

export function PaymentDialog({
  open,
  onOpenChange,
  productType,
  productId,
  productName,
  originalAmount,
  sport = 'cornhole',
  onSuccess,
  onCancel,
}: PaymentDialogProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [finalAmount, setFinalAmount] = useState(originalAmount);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Sport-specific colors
  const sportColor = sport === 'cornhole' 
    ? { bg: 'bg-green-600', hover: 'hover:bg-green-700', text: 'text-green-600', border: 'border-green-500' }
    : { bg: 'bg-teal-600', hover: 'hover:bg-teal-700', text: 'text-teal-600', border: 'border-teal-500' };

  // Load Razorpay script
  useEffect(() => {
    if (open && typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
        setError('Failed to load payment gateway. Please refresh and try again.');
      };
      document.body.appendChild(script);
    } else if (typeof window !== 'undefined' && window.Razorpay) {
      setScriptLoaded(true);
    }
  }, [open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStatus('idle');
      setError(null);
      setAppliedCoupon(null);
      setFinalAmount(originalAmount);
    }
  }, [open, originalAmount]);

  // Handle coupon applied
  const handleCouponApplied = useCallback((discount: AppliedCoupon) => {
    setAppliedCoupon(discount);
    setFinalAmount(discount.finalAmount);
    setError(null);
  }, []);

  // Handle coupon removed
  const handleCouponRemoved = useCallback(() => {
    setAppliedCoupon(null);
    setFinalAmount(originalAmount);
    setError(null);
  }, [originalAmount]);

  // Record coupon usage after successful payment
  const recordCouponUsage = useCallback(async (couponId: string, paymentId: string) => {
    try {
      await fetch('/api/coupons/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponId,
          productId,
          productType,
          paymentId,
          discountAmount: appliedCoupon?.discountAmount || 0,
        }),
      });
    } catch (err) {
      console.error('Failed to record coupon usage:', err);
      // Don't fail the payment for coupon recording failure
    }
  }, [appliedCoupon, productId, productType]);

  // Handle payment process
  const handlePayment = useCallback(async () => {
    if (!scriptLoaded) {
      setError('Payment system not loaded. Please try again.');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      // Create order from backend
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: productType === 'tournament' ? 'TOURNAMENT_ENTRY' : 'PLAYER_SUBSCRIPTION',
          sport: sport.toUpperCase(),
          tournamentId: productType === 'tournament' ? productId : undefined,
          amount: finalAmount, // Send discounted amount
          couponId: appliedCoupon?.couponId,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const data: PaymentOrderResponse = await orderResponse.json();

      // Update status to processing
      setStatus('processing');

      // Open Razorpay checkout
      const razorpayOptions: RazorpayOptions = {
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: 'VALORHIVE',
        description: productName,
        prefill: {
          name: data.payer.name,
          email: data.payer.email || undefined,
          contact: data.payer.phone || undefined,
        },
        theme: {
          color: sport === 'cornhole' ? '#16a34a' : '#0d9488', // Green for cornhole, teal for darts
        },
        handler: async (response) => {
          try {
            // Verify payment
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                paymentType: productType === 'tournament' ? 'TOURNAMENT_ENTRY' : 'PLAYER_SUBSCRIPTION',
                sport: sport.toUpperCase(),
                tournamentId: productType === 'tournament' ? productId : undefined,
              }),
            });

            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              throw new Error(errorData.error || 'Payment verification failed');
            }

            // Record coupon usage if coupon was applied
            if (appliedCoupon) {
              await recordCouponUsage(appliedCoupon.couponId, response.razorpay_payment_id);
            }

            setStatus('success');
            
            // Call onSuccess after a brief delay to show success state
            setTimeout(() => {
              onSuccess();
              onOpenChange(false);
            }, 1500);
          } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            setStatus('idle');
            setError('Payment cancelled. Please try again.');
          },
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
    }
  }, [scriptLoaded, productType, sport, productId, productName, finalAmount, appliedCoupon, recordCouponUsage, onSuccess, onOpenChange]);

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (status === 'loading' || status === 'processing') {
      // Prevent closing during payment process
      return;
    }
    if (!newOpen && status !== 'success') {
      onCancel();
    }
    onOpenChange(newOpen);
  };

  // Calculate discount percentage for display
  const discountPercentage = appliedCoupon && originalAmount > 0
    ? Math.round((appliedCoupon.discountAmount / originalAmount) * 100)
    : 0;

  // Render success state
  if (status === 'success') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className={cn(
              "flex items-center justify-center w-16 h-16 rounded-full",
              sport === 'cornhole' ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30"
            )}>
              <Check className={cn("w-8 h-8", sportColor.text)} />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">Payment Successful!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {productType === 'tournament' 
                  ? 'You have been successfully registered.' 
                  : 'Your subscription has been activated.'}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Summary
          </DialogTitle>
          <DialogDescription>
            Review your order and complete payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <Badge variant="outline" className={cn("mb-2", sportColor.text, sportColor.border)}>
                {productType === 'tournament' ? 'Tournament Entry' : 'Membership'}
              </Badge>
              <h4 className="font-medium text-foreground">{productName}</h4>
              {productType === 'tournament' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Entry fee for tournament participation
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(originalAmount)}
              </p>
            </div>
          </div>

          {/* Coupon Input Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Tag className="w-4 h-4" />
              Have a coupon code?
            </div>
            <CouponInput
              productId={productId}
              productType={productType}
              originalAmount={originalAmount}
              onCouponApplied={handleCouponApplied}
              onCouponRemoved={handleCouponRemoved}
            />
          </div>

          {/* Price Breakdown */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
            <h4 className="text-sm font-medium text-foreground">Price Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Original Price</span>
                <span className="text-foreground">{formatCurrency(originalAmount)}</span>
              </div>
              
              {appliedCoupon && (
                <div className="flex justify-between text-sm">
                  <span className={cn("flex items-center gap-1", sportColor.text)}>
                    <Tag className="w-3 h-3" />
                    Coupon Discount
                    {appliedCoupon.discountType === 'PERCENTAGE' && (
                      <span className="text-xs">({discountPercentage}% off)</span>
                    )}
                  </span>
                  <span className={sportColor.text}>
                    -{formatCurrency(appliedCoupon.discountAmount)}
                  </span>
                </div>
              )}
              
              <Separator className="my-2" />
              
              <div className="flex justify-between">
                <span className="font-medium text-foreground">Final Amount</span>
                <span className={cn(
                  "text-lg font-semibold",
                  appliedCoupon ? sportColor.text : "text-foreground"
                )}>
                  {formatCurrency(finalAmount)}
                </span>
              </div>

              {appliedCoupon && appliedCoupon.discountAmount > 0 && (
                <p className={cn("text-xs", sportColor.text)}>
                  You save {formatCurrency(appliedCoupon.discountAmount)} with this coupon!
                </p>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Security Note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <span>Secured by Razorpay. Your payment information is encrypted.</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={status === 'loading' || status === 'processing'}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={status === 'loading' || status === 'processing' || !scriptLoaded}
            className={cn("w-full sm:w-auto", sportColor.bg, sportColor.hover)}
          >
            {status === 'loading' || status === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {status === 'loading' ? 'Creating Order...' : 'Processing...'}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pay {formatCurrency(finalAmount)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentDialog;
