"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  Check,
  Crown,
  Zap,
  Star,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  TrendingUp,
  Shield,
  Clock,
  XCircle,
  Tag,
  Trash2,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRazorpay, PAYMENT_TYPES } from "@/hooks/use-razorpay";

interface SubscriptionStatus {
  isSubscribed: boolean;
  plan: string | null;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
}

// Fixed pricing as per requirements
const SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 0,
    yearlyPrice: 0,
    description: "View only access",
    features: [
      "Browse all tournaments",
      "View brackets & results",
      "Access leaderboards",
      "View player profiles",
    ],
    notIncluded: [
      "Tournament participation",
      "State & National tournaments",
      "Priority tournament registration",
      "Advanced statistics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 1200, // ₹1,200 per year as specified
    yearlyPrice: 1200,
    description: "Full access for competitive players",
    features: [
      "All Basic features",
      "Participate in ALL tournaments",
      "Priority tournament registration",
      "Advanced statistics & analytics",
      "Exclusive tournaments access",
    ],
    popular: true,
  },
];

export default function SubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coupon code state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    discountType: string;
    discountValue: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const originalPrice = 120000; // ₹1,200 in paise
  const finalPrice = appliedCoupon
    ? Math.max(0, originalPrice - appliedCoupon.discount)
    : originalPrice;

  const { initiatePayment, loading: paymentLoading, scriptLoaded } = useRazorpay({
    onSuccess: (response) => {
      setSuccess("Subscription activated successfully! You now have access to all premium features.");
      fetchSubscription();
    },
    onError: (err) => {
      setError(err.message || "Payment failed. Please try again.");
    },
    onDismiss: () => {
      console.log("Payment dismissed");
    },
  });

  const primaryTextClass = isCornhole ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-900/20" : "bg-teal-50 dark:bg-teal-900/20";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";

  useEffect(() => {
    fetchSubscription();
  }, [sport]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/player/subscription?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || selectedPlan === "basic") return;
    
    setError(null);
    setSuccess(null);

    // Initiate Razorpay payment
    await initiatePayment({
      paymentType: PAYMENT_TYPES.PLAYER_SUBSCRIPTION,
      sport: sport.toUpperCase(),
      productName: "VALORHIVE Pro Subscription - 1 Year",
    });
  };

  // Coupon functions
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: couponCode.trim().toUpperCase(),
          productType: 'PLAYER_SUBSCRIPTION',
          amount: originalPrice,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCouponError(data.error || 'Invalid coupon code');
        return;
      }

      setAppliedCoupon({
        code: data.coupon.code,
        discount: data.discount,
        discountType: data.coupon.discountType,
        discountValue: data.coupon.discountValue,
      });
      setCouponCode("");
    } catch (err) {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  if (loading) {
    return (
      <div className="bg-background flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-5xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
            <p className="text-muted-foreground">Manage your subscription plan</p>
          </div>

          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">{success}</AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Subscription Status */}
          {subscription?.isSubscribed ? (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                <strong>Active Subscription:</strong> You are subscribed for this sport.
                {subscription.endDate && ` Valid until ${new Date(subscription.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`}
                <span className="block mt-1 text-sm">You can participate in all tournaments at every level.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-6 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-700 dark:text-red-400">
                <strong>Subscription Required:</strong> You cannot participate in any tournament without an active subscription.
                <span className="block mt-1 text-sm">Subscribe now to register and compete in tournaments at all levels.</span>
              </AlertDescription>
            </Alert>
          )}

          {/* What's Included - View vs Participate */}
          <Card className="mb-6 border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className={cn("w-4 h-4", primaryTextClass)} />
                View vs Participate
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Free (View Only)
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Browse all tournaments</li>
                    <li>✓ View brackets & results</li>
                    <li>✓ Access leaderboards</li>
                    <li>✓ View player profiles</li>
                    <li className="text-red-600 dark:text-red-400 font-medium">✗ Cannot participate in ANY tournament</li>
                  </ul>
                </div>
                <div className={cn("p-3 rounded-lg", primaryBgClass)}>
                  <p className={cn("font-medium mb-2 flex items-center gap-2", primaryTextClass)}>
                    <Crown className="w-4 h-4" />
                    Pro (Full Access)
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ All Free features</li>
                    <li className="text-emerald-600 dark:text-emerald-400">✓ Participate in ALL tournaments</li>
                    <li className="text-emerald-600 dark:text-emerald-400">✓ City, District, State & National</li>
                    <li>✓ Priority registration</li>
                    <li>✓ Advanced analytics</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Info Card */}
          <Card className={cn("mb-6 border-l-4 bg-card", isCornhole ? "border-l-green-500" : "border-l-teal-500")}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Calendar className={cn("w-6 h-6 flex-shrink-0", primaryTextClass)} />
                <div>
                  <h4 className="font-medium text-foreground mb-1">Yearly Subscription</h4>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Subscription is required to participate in any tournament.</strong> Valid for 1 year from purchase. Unlock all tournaments and premium features.
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-2">
                    Price: ₹1,200 per year per sport
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const isCurrentPlan = subscription?.isSubscribed && plan.id === "pro";

              return (
                <Card 
                  key={plan.id}
                  className={cn(
                    "relative bg-card border-border shadow-sm transition-all cursor-pointer",
                    isSelected && cn("ring-2", primaryBorderClass),
                    plan.popular && "ring-2 ring-amber-400",
                    isCurrentPlan && "ring-2 ring-emerald-400"
                  )}
                  onClick={() => plan.id !== "basic" && !subscription?.isSubscribed && setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-white border-0">
                        <Star className="w-3 h-3 mr-1" />
                        Recommended
                      </Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-emerald-500 text-white border-0">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-2">
                    <div className={cn(
                      "w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center",
                      plan.id === "basic" ? "bg-muted" : "bg-amber-100 dark:bg-amber-900/30"
                    )}>
                      {plan.id === "basic" ? (
                        <Zap className="w-6 h-6 text-muted-foreground" />
                      ) : (
                        <Crown className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                      )}
                    </div>
                    <CardTitle className="text-foreground">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {/* Pricing */}
                    <div className="text-center mb-4">
                      {plan.price === 0 ? (
                        <div className="text-3xl font-bold text-foreground">Free</div>
                      ) : (
                        <>
                          <div className="text-3xl font-bold text-foreground">
                            ₹{plan.price.toLocaleString("en-IN")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            per year
                          </div>
                        </>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                      {plan.notIncluded?.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm opacity-50">
                          <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Select Button */}
                    {plan.id !== "basic" && !isCurrentPlan && !subscription?.isSubscribed && (
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "w-full",
                          isSelected && cn("text-white", primaryBtnClass)
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan.id);
                        }}
                      >
                        {isSelected ? "Selected" : "Select Plan"}
                      </Button>
                    )}
                    {(isCurrentPlan || subscription?.isSubscribed) && plan.id === "pro" && (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Active Subscription
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Coupon Code Section */}
          {selectedPlan && selectedPlan !== "basic" && !subscription?.isSubscribed && (
            <Card className="bg-card border-border shadow-sm mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className={cn("w-4 h-4", primaryTextClass)} />
                  Have a Promo Code?
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {appliedCoupon ? (
                  <div className={cn("flex items-center justify-between p-3 rounded-lg border", primaryBgClass, primaryBorderClass)}>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={cn("w-5 h-5", primaryTextClass)} />
                      <div>
                        <p className="font-medium text-foreground">{appliedCoupon.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {appliedCoupon.discountType === 'PERCENTAGE' 
                            ? `${appliedCoupon.discountValue}% off` 
                            : appliedCoupon.discountType === 'FREE_ENTRY'
                            ? 'Free subscription!'
                            : `₹${(appliedCoupon.discountValue / 100).toLocaleString()} off`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Enter promo code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleApplyCoupon();
                          }
                        }}
                        className={cn(couponError && "border-red-500")}
                      />
                      {couponError && (
                        <p className="text-xs text-red-500 mt-1">{couponError}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="flex-shrink-0"
                    >
                      {couponLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Subscribe Button */}
          {selectedPlan && selectedPlan !== "basic" && !subscription?.isSubscribed && (
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">
                      Subscribe to Pro Plan
                    </h4>
                    {appliedCoupon ? (
                      <div className="text-sm">
                        <span className="line-through text-muted-foreground mr-2">₹1,200</span>
                        <span className="font-semibold text-foreground">
                          ₹{(finalPrice / 100).toLocaleString()}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 ml-2">
                          (You save ₹{(appliedCoupon.discount / 100).toLocaleString()})
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Amount: ₹1,200 per year
                      </p>
                    )}
                  </div>
                  <Button
                    className={cn("text-white gap-2", primaryBtnClass)}
                    onClick={handleSubscribe}
                    disabled={paymentLoading || !scriptLoaded}
                  >
                    {paymentLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay ₹{(finalPrice / 100).toLocaleString()}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Features Comparison */}
          <Card className="bg-card border-border shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Why Subscribe?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", primaryBgClass)}>
                    <Crown className={cn("w-5 h-5", primaryTextClass)} />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Tournament Participation</h4>
                    <p className="text-sm text-muted-foreground">Required to compete in any tournament at any level</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", primaryBgClass)}>
                    <Clock className={cn("w-5 h-5", primaryTextClass)} />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Priority Registration</h4>
                    <p className="text-sm text-muted-foreground">Get early access to tournament registrations</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", primaryBgClass)}>
                    <TrendingUp className={cn("w-5 h-5", primaryTextClass)} />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Advanced Analytics</h4>
                    <p className="text-sm text-muted-foreground">Track your performance with detailed statistics</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
