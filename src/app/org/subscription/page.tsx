"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import OrgSidebar from "@/components/layout/org-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  Check,
  ShoppingCart,
  Tag,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  AlertCircle,
  Trash2,
  Calendar,
  Clock,
  Eye,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Sport configurations - SINGLE PLAN PER SPORT
const SPORT_CONFIGS = [
  { id: "CORNHOLE", name: "Cornhole", icon: "🎯", color: "bg-green-500", description: "Bag toss competition" },
  { id: "DARTS", name: "Darts", icon: "🎯", color: "bg-teal-500", description: "Precision throwing" },
  { id: "BADMINTON", name: "Badminton", icon: "🏸", color: "bg-blue-500", description: "Racquet sport" },
  { id: "CRICKET", name: "Cricket", icon: "🏏", color: "bg-orange-500", description: "Bat and ball game" },
  { id: "FOOTBALL", name: "Football", icon: "⚽", color: "bg-emerald-500", description: "The beautiful game" },
  { id: "TABLE_TENNIS", name: "Table Tennis", icon: "🏓", color: "bg-purple-500", description: "Ping pong" },
];

// FIXED PRICING: ₹50,000 per sport per year (in paise for calculations)
const PRICE_PER_SPORT = 5000000; // ₹50,000 in paise

interface ActiveSubscription {
  sport: string;
  startDate?: string;
  endDate: string;
  status: string;
  amount?: number;
}

interface PromoCode {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  maxDiscount?: number;
}

interface CartItem {
  sportId: string;
  sportName: string;
  price: number;
}

export default function OrgSubscriptionPage() {
  const router = useRouter();
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([
    // Demo: Pre-subscribed sports for showcase
    {
      sport: "CORNHOLE",
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
      endDate: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(), // ~9 months from now
      status: "ACTIVE",
      amount: 5000000,
    },
    {
      sport: "DARTS",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(), // ~11 months from now
      status: "ACTIVE",
      amount: 5000000,
    },
  ]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [orgName, setOrgName] = useState("Organization");

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const response = await fetch("/api/org/subscription", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch subscription");
      }
      const data = await response.json();
      
      // For demo/testing: Merge with demo subscriptions if API returns empty
      // Remove this logic in production
      if (data.activeSubscriptions && data.activeSubscriptions.length > 0) {
        setActiveSubscriptions(data.activeSubscriptions);
      }
      // Otherwise keep the demo subscriptions already set in state
      
      setOrgName(data.orgName || "Organization");
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      // Keep demo subscriptions on error
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceInPaise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(priceInPaise / 100);
  };

  // Check if a sport is already subscribed
  const isSportSubscribed = (sportId: string) => {
    return activeSubscriptions.some((sub) => sub.sport === sportId && sub.status === "ACTIVE");
  };

  // Get subscription details for a sport
  const getSubscriptionDetails = (sportId: string) => {
    return activeSubscriptions.find((s) => s.sport === sportId);
  };

  // Get available (unsubscribed) sports - IMPORTANT: Only these can be purchased
  const availableSports = useMemo(() => {
    return SPORT_CONFIGS.filter((config) => !isSportSubscribed(config.id));
  }, [activeSubscriptions]);

  // Get subscribed sports - IMPORTANT: These are separate from purchasable
  const subscribedSports = useMemo(() => {
    return SPORT_CONFIGS.filter((config) => isSportSubscribed(config.id));
  }, [activeSubscriptions]);

  // Check if all available sports are selected
  const isAllSelected = useMemo(() => {
    return availableSports.length > 0 && selectedSports.length === availableSports.length;
  }, [availableSports, selectedSports]);

  // Check if some (but not all) available sports are selected
  const isPartialSelected = useMemo(() => {
    return selectedSports.length > 0 && selectedSports.length < availableSports.length;
  }, [availableSports, selectedSports]);

  // Handle Select All - ONLY affects unsubscribed sports
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSports([]);
    } else {
      // Select ALL available (unsubscribed) sports
      setSelectedSports(availableSports.map((config) => config.id));
    }
  };

  // Handle individual sport toggle - ONLY for unsubscribed sports
  const handleSportToggle = (sportId: string) => {
    // SAFETY: Don't allow selecting already subscribed sports
    if (isSportSubscribed(sportId)) return;

    setSelectedSports((prev) =>
      prev.includes(sportId) ? prev.filter((s) => s !== sportId) : [...prev, sportId]
    );
  };

  // Calculate cart totals - ONLY for selected unsubscribed sports
  const cartItems: CartItem[] = useMemo(() => {
    return selectedSports.map((sportId) => {
      const config = SPORT_CONFIGS.find((s) => s.id === sportId)!;
      return {
        sportId,
        sportName: config.name,
        price: PRICE_PER_SPORT,
      };
    });
  }, [selectedSports]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price, 0);
  }, [cartItems]);

  const discount = useMemo(() => {
    if (!appliedPromo) return 0;
    
    let discountAmount = 0;
    if (appliedPromo.discountType === "PERCENTAGE") {
      discountAmount = Math.floor((subtotal * appliedPromo.discountValue) / 100);
      if (appliedPromo.maxDiscount && discountAmount > appliedPromo.maxDiscount) {
        discountAmount = appliedPromo.maxDiscount;
      }
    } else {
      discountAmount = appliedPromo.discountValue;
    }
    return discountAmount;
  }, [appliedPromo, subtotal]);

  const total = subtotal - discount;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    
    setPromoError("");
    
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: promoCode.trim().toUpperCase(),
          productType: "SUBSCRIPTION",
          amount: subtotal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPromoError(data.error || "Invalid promo code");
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({
        code: data.coupon.couponCode,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
        maxDiscount: data.coupon.maxDiscountLimit,
      });
    } catch (error) {
      setPromoError("Failed to validate promo code");
      setAppliedPromo(null);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    setCheckoutLoading(true);

    try {
      const response = await fetch("/api/org/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sports: selectedSports,
          promoCode: appliedPromo?.code,
          amount: total,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      // Redirect to payment gateway
      if (data.keyId) {
        // Initialize Razorpay checkout
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.orderId,
          name: "ValorHive Subscription",
          description: `Subscription for ${data.sports.length} sport(s)`,
          prefill: {
            name: data.payer?.name,
            email: data.payer?.email,
            contact: data.payer?.phone,
          },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            // Verify payment
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                paymentLedgerId: data.paymentLedgerId,
              }),
            });

            if (verifyResponse.ok) {
              router.push("/org/home?payment=success");
            } else {
              alert("Payment verification failed. Please contact support.");
            }
          },
          theme: {
            color: "#7c3aed",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to initiate checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <OrgSidebar />
        <main className="ml-0 md:ml-72">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading subscriptions...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <OrgSidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6 space-y-6 max-w-7xl">
          {/* Header */}
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push("/org/home")}
              className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscriptions</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage sports subscriptions for {orgName}
            </p>
          </div>

          {/* ==================================================
              SECTION 1: ACTIVE SUBSCRIPTIONS
              Shows ONLY already subscribed sports
              These sports are NOT available for purchase
          ================================================== */}
          {subscribedSports.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Check className="w-5 h-5 text-green-500" />
                  Active Subscriptions ({subscribedSports.length})
                </CardTitle>
                <CardDescription>
                  Sports your organization is currently subscribed to
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {subscribedSports.map((config) => {
                    const subDetails = getSubscriptionDetails(config.id);
                    return (
                      <div
                        key={config.id}
                        className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl", config.color)}>
                            {config.icon}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {config.name}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {subDetails?.startDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Started: {new Date(subDetails.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Valid till: {new Date(subDetails?.endDate || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">₹50,000/year</p>
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mt-1">
                              <Check className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ==================================================
                SECTION 2: AVAILABLE SPORTS
                Shows ONLY sports NOT currently subscribed
                These are the ONLY sports that can be purchased
            ================================================== */}
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Available Sports
                      </CardTitle>
                      <CardDescription>
                        Select sports to subscribe — ₹50,000 per sport per year
                      </CardDescription>
                    </div>
                    {/* Select All - ONLY affects unsubscribed sports */}
                    {availableSports.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          id="select-all"
                          onClick={handleSelectAll}
                          className={cn(
                            "w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all",
                            isAllSelected
                              ? "bg-purple-600 border-purple-600"
                              : isPartialSelected
                              ? "bg-purple-600 border-purple-600"
                              : "bg-white dark:bg-gray-800 border-gray-400 hover:border-gray-500"
                          )}
                        >
                          {isAllSelected && <Check className="w-3 h-3 text-white" />}
                          {isPartialSelected && <Minus className="w-3 h-3 text-white" />}
                        </button>
                        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                          Select All ({availableSports.length})
                        </Label>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {availableSports.length === 0 ? (
                    <div className="text-center py-12">
                      <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        All Sports Subscribed!
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        Your organization has active subscriptions for all available sports.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {availableSports.map((config) => {
                        const isSelected = selectedSports.includes(config.id);

                        return (
                          <div
                            key={config.id}
                            className={cn(
                              "relative p-4 rounded-lg border-2 transition-all cursor-pointer",
                              isSelected
                                ? "bg-purple-50 dark:bg-purple-950/20 border-purple-500 dark:border-purple-500"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600"
                            )}
                            onClick={() => handleSportToggle(config.id)}
                          >
                            {/* Checkbox */}
                            <div className="absolute top-3 right-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedSports((prev) => [...prev, config.id]);
                                  } else {
                                    setSelectedSports((prev) => prev.filter((s) => s !== config.id));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 cursor-pointer"
                              />
                            </div>

                            {/* Sport Icon & Name */}
                            <div className="flex items-center gap-3 mb-3 pr-8">
                              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl", config.color)}>
                                {config.icon}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  {config.name}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {config.description}
                                </p>
                              </div>
                            </div>

                            {/* Price & Status */}
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600 dark:text-gray-400 font-medium">
                                ₹50,000/year
                              </span>
                              <Badge className={cn(
                                "text-xs",
                                isSelected
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                              )}>
                                {isSelected ? (
                                  <><Plus className="w-3 h-3 mr-1" /> Added</>
                                ) : (
                                  "Not Subscribed"
                                )}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ==================================================
                SECTION 3, 4, 5: CART SUMMARY, PROMO CODE, CHECKOUT
                Only includes newly selected sports
            ================================================== */}
            <div className="lg:col-span-1 space-y-4">
              {/* Cart Summary */}
              <Card className="bg-white dark:bg-gray-800 sticky top-20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Cart Summary
                  </CardTitle>
                  <CardDescription>
                    {cartItems.length} sport{cartItems.length !== 1 ? 's' : ''} selected
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartItems.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No sports selected</p>
                      <p className="text-xs mt-1">Select sports from the grid above</p>
                    </div>
                  ) : (
                    <>
                      {/* Cart Items */}
                      <div className="space-y-3">
                        {cartItems.map((item) => (
                          <div
                            key={item.sportId}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <span className="font-medium text-gray-900 dark:text-white">
                              {item.sportName}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {formatPrice(item.price)}
                              </span>
                              <button
                                onClick={() => handleSportToggle(item.sportId)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove from cart"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Promo Code Section */}
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          Promo Code
                        </Label>
                        {appliedPromo ? (
                          <div className="flex items-center justify-between mt-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-700 dark:text-green-400">
                                {appliedPromo.code}
                              </span>
                            </div>
                            <button
                              onClick={handleRemovePromo}
                              className="text-red-500 hover:text-red-600"
                              title="Remove promo code"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-2">
                            <Input
                              placeholder="Enter promo code"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              onClick={handleApplyPromo}
                              disabled={!promoCode.trim()}
                            >
                              Apply
                            </Button>
                          </div>
                        )}
                        {promoError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {promoError}
                          </p>
                        )}
                      </div>

                      {/* Totals */}
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal ({cartItems.length} sports)</span>
                          <span className="text-gray-900 dark:text-white">{formatPrice(subtotal)}</span>
                        </div>
                        {appliedPromo && discount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600 dark:text-green-400">
                              Discount ({appliedPromo.code})
                            </span>
                            <span className="text-green-600 dark:text-green-400">
                              -{formatPrice(discount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-900 dark:text-white">Total</span>
                          <span className="text-purple-600 dark:text-purple-400">
                            {formatPrice(total)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Annual subscription, auto-renews each year
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
                
                {/* Checkout Button */}
                {cartItems.length > 0 && (
                  <CardFooter className="pt-0">
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Proceed to Payment
                        </>
                      )}
                    </Button>
                  </CardFooter>
                )}
              </Card>

              {/* Info Card */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Subscription Info
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Fixed price: ₹50,000 per sport per year</li>
                    <li>• Subscribe to multiple sports in one checkout</li>
                    <li>• Active sports shown separately above</li>
                    <li>• Promo codes apply to new purchases only</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
