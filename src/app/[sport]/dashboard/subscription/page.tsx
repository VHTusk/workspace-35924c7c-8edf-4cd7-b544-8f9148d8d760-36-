"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  currentPlan: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  amount: number | null;
  features: string[];
}

const plans = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    features: [
      { name: "Join tournaments", included: true },
      { name: "Basic stats tracking", included: true },
      { name: "Public profile", included: true },
      { name: "Priority registration", included: false },
      { name: "Advanced analytics", included: false },
      { name: "Exclusive tournaments", included: false },
      { name: "No platform fees", included: false },
    ],
  },
  {
    name: "Pro",
    price: 299,
    period: "month",
    popular: true,
    features: [
      { name: "Join tournaments", included: true },
      { name: "Basic stats tracking", included: true },
      { name: "Public profile", included: true },
      { name: "Priority registration", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Exclusive tournaments", included: false },
      { name: "No platform fees", included: false },
    ],
  },
  {
    name: "Elite",
    price: 999,
    period: "month",
    features: [
      { name: "Join tournaments", included: true },
      { name: "Basic stats tracking", included: true },
      { name: "Public profile", included: true },
      { name: "Priority registration", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Exclusive tournaments", included: true },
      { name: "No platform fees", included: true },
    ],
  },
];

export default function DashboardSubscriptionPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";

  useEffect(() => {
    fetchSubscription();
  }, [sport]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch(`/api/subscription?sport=${sport.toUpperCase()}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    setProcessingPlan(planName);
    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planName.toUpperCase(), sport: sport.toUpperCase() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        }
      }
    } catch (err) {
      console.error("Failed to subscribe:", err);
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">Choose a plan that suits your needs</p>
      </div>

      {/* Current Plan */}
      {subscription?.currentPlan && (
        <Card className={cn(primaryBgClass, "border", primaryBorderClass)}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-full", primaryClass)}>
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{subscription.currentPlan} Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    {subscription.status === "ACTIVE" ? (
                      <>Renews on {new Date(subscription.endDate!).toLocaleDateString()}</>
                    ) : (
                      subscription.status
                    )}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.name} className={cn(
            "relative",
            plan.popular && cn("border-2", primaryBorderClass),
            subscription?.currentPlan === plan.name.toUpperCase() && primaryBgClass
          )}>
            {plan.popular && (
              <div className={cn("absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white", primaryClass)}>
                Most Popular
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle>{plan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">₹{plan.price}</span>
                {plan.price > 0 && <span className="text-muted-foreground">/{plan.period}</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className={cn("w-5 h-5", primaryTextClass)} />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className={cn(!feature.included && "text-muted-foreground")}>{feature.name}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={cn("w-full", plan.popular && primaryClass, subscription?.currentPlan === plan.name.toUpperCase() && "bg-muted text-muted-foreground")}
                variant={plan.popular ? "default" : "outline"}
                disabled={subscription?.currentPlan === plan.name.toUpperCase() || processingPlan === plan.name}
                onClick={() => handleSubscribe(plan.name)}
              >
                {processingPlan === plan.name ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : subscription?.currentPlan === plan.name.toUpperCase() ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : null}
                {subscription?.currentPlan === plan.name.toUpperCase() ? "Current Plan" : plan.price === 0 ? "Current Plan" : "Subscribe"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Subscription Benefits
          </CardTitle>
          <CardDescription>What you get with a premium subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className={cn("w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                <Crown className={cn("w-6 h-6", primaryTextClass)} />
              </div>
              <h4 className="font-semibold mb-1">Priority Access</h4>
              <p className="text-sm text-muted-foreground">Get early access to tournament registrations</p>
            </div>
            <div className="text-center p-4">
              <div className={cn("w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                <Zap className={cn("w-6 h-6", primaryTextClass)} />
              </div>
              <h4 className="font-semibold mb-1">Zero Fees</h4>
              <p className="text-sm text-muted-foreground">No platform fees on Elite plan</p>
            </div>
            <div className="text-center p-4">
              <div className={cn("w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                <Crown className={cn("w-6 h-6", primaryTextClass)} />
              </div>
              <h4 className="font-semibold mb-1">Exclusive Events</h4>
              <p className="text-sm text-muted-foreground">Access to members-only tournaments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
