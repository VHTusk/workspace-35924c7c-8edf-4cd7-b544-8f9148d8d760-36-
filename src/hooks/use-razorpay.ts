'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithCsrf } from '@/lib/client-csrf';

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}

export interface RazorpayOptions {
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

interface UseRazorpayOptions {
  onSuccess?: (response: RazorpayResponse) => void;
  onError?: (error: Error) => void;
  onDismiss?: () => void;
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

export function useRazorpay(options: UseRazorpayOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => console.error('Failed to load Razorpay script');
      document.body.appendChild(script);
    } else if (typeof window !== 'undefined' && window.Razorpay) {
      setScriptLoaded(true);
    }
  }, []);

  const initiatePayment = useCallback(async (params: {
    paymentType: string;
    sport: string;
    tournamentId?: string;
    orgType?: 'CLUB' | 'SCHOOL' | 'CORPORATE';
    productName?: string;
  }) => {
    if (!scriptLoaded) {
      options.onError?.(new Error('Payment system not loaded. Please try again.'));
      return;
    }

    setLoading(true);

    try {
      // Create order from backend
      const orderResponse = await fetchWithCsrf('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentType: params.paymentType,
          sport: params.sport,
          tournamentId: params.tournamentId,
          orgType: params.orgType,
        }),
      });

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const data: PaymentOrderResponse = await orderResponse.json();

      // Open Razorpay checkout
      const razorpayOptions: RazorpayOptions = {
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: 'VALORHIVE',
        description: params.productName || params.paymentType.replace(/_/g, ' '),
        prefill: {
          name: data.payer.name,
          email: data.payer.email || undefined,
          contact: data.payer.phone || undefined,
        },
        theme: {
          color: '#6366f1', // Primary color
        },
        handler: async (response) => {
          try {
            // Verify payment
            const verifyResponse = await fetchWithCsrf('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                paymentType: params.paymentType,
                sport: params.sport,
                tournamentId: params.tournamentId,
              }),
            });

            if (!verifyResponse.ok) {
              const error = await verifyResponse.json();
              throw new Error(error.error || 'Payment verification failed');
            }

            options.onSuccess?.(response);
          } catch (error) {
            options.onError?.(error instanceof Error ? error : new Error('Payment verification failed'));
          }
        },
        modal: {
          ondismiss: () => {
            options.onDismiss?.();
          },
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('Payment failed'));
    } finally {
      setLoading(false);
    }
  }, [scriptLoaded, options]);

  return {
    initiatePayment,
    loading,
    scriptLoaded,
  };
}

// Payment type constants
export const PAYMENT_TYPES = {
  PLAYER_SUBSCRIPTION: 'PLAYER_SUBSCRIPTION',
  ORG_SUBSCRIPTION_SCHOOL_CLUB: 'ORG_SUBSCRIPTION_SCHOOL_CLUB',
  ORG_SUBSCRIPTION_CORPORATE: 'ORG_SUBSCRIPTION_CORPORATE',
  TOURNAMENT_ENTRY: 'TOURNAMENT_ENTRY',
  TEAM_TOURNAMENT_ENTRY: 'TEAM_TOURNAMENT_ENTRY',
  INTER_ORG_TOURNAMENT_ENTRY: 'INTER_ORG_TOURNAMENT_ENTRY',
} as const;
