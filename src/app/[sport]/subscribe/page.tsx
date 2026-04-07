"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    id: "BASIC",
    name: "Basic",
    price: 499,
    description: "Get started with tournament access",
    features: [
      "Access to city-level tournaments",
      "Basic leaderboard participation",
      "Email support",
      "Player profile",
    ],
    tier: "basic",
  },
  {
    id: "PRO",
    name: "Pro",
    price: 999,
    description: "For serious competitors",
    features: [
      "All Basic features",
      "Access to all tournament levels",
      "Priority tournament registration",
      "Detailed statistics & analytics",
      "Priority support",
      "Early bird notifications",
    ],
    tier: "pro",
    popular: true,
  },
  {
    id: "ENTERPRISE",
    name: "Elite",
    price: 2499,
    description: "For professional players",
    features: [
      "All Pro features",
      "Exclusive tournaments access",
      "Personal ranking coach",
      "Video analysis tools",
      "Tournament preparation resources",
      "VIP support",
    ],
    tier: "enterprise",
  },
];

export default function SubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async (planId: string) => {
    setSelectedPlan(planId);
    setIsProcessing(true);
    setTimeout(() => {
      router.push(`/${sport}/dashboard`);
    }, 2000);
  };

  const today = new Date();
  const financialYearEnd = new Date(today.getFullYear(), 2, 31);
  if (today > financialYearEnd) {
    financialYearEnd.setFullYear(today.getFullYear() + 1);
  }
  const monthsRemaining = Math.max(
    1,
    (financialYearEnd.getFullYear() - today.getFullYear()) * 12 +
      (financialYearEnd.getMonth() - today.getMonth()) +
      (financialYearEnd.getDate() >= today.getDate() ? 1 : 0)
  );

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <Link href={`/${sport}/dashboard`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Pro Player
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Subscribe to unlock tournament access. Your subscription is valid until March 31.
            {monthsRemaining > 1 && (
              <span className="block mt-2 text-primary font-medium">
                Pro-rata pricing: {monthsRemaining} months remaining
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative bg-gradient-card border-border/50 ${
                plan.popular ? "border-primary/50 scale-105" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <div className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                  plan.tier === "basic" ? "bg-muted" :
                  plan.tier === "pro" ? "bg-primary/20" : "bg-amber-500/20"
                }`}>
                  {plan.tier === "basic" ? (
                    <Zap className="w-6 h-6 text-muted-foreground" />
                  ) : plan.tier === "pro" ? (
                    <Crown className="w-6 h-6 text-primary" />
                  ) : (
                    <Building2 className="w-6 h-6 text-amber-400" />
                  )}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">
                    ₹{Math.round(plan.price * monthsRemaining / 12)}
                  </span>
                  <span className="text-muted-foreground"> /year</span>
                </div>

                <ul className="space-y-3 mb-6 text-left">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isProcessing}
                >
                  {isProcessing && selectedPlan === plan.id ? "Processing..." : "Subscribe Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="bg-gradient-card border-border/50 max-w-2xl mx-auto">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-2">Payment Methods</h3>
              <p className="text-sm text-muted-foreground mb-4">Secure payments powered by Razorpay</p>
              <div className="flex items-center justify-center gap-4">
                <Badge variant="outline">UPI</Badge>
                <Badge variant="outline">Card</Badge>
                <Badge variant="outline">Net Banking</Badge>
                <Badge variant="outline">Wallet</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
