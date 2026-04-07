"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Crown,
  CreditCard,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
  ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  amount: number;
  daysRemaining?: number;
  trialEndsAt?: string;
}

interface OrgSubscriptionCardProps {
  subscription: SubscriptionData | null;
  sport: string;
  onUpgrade?: () => void;
  onRenew?: () => void;
}

const PLAN_INFO: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof Crown;
  features: string[];
}> = {
  BASIC: {
    label: "Basic",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    icon: CreditCard,
    features: [
      "Up to 25 roster players",
      "Basic tournament entry",
      "Standard support",
    ],
  },
  PRO: {
    label: "Pro",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-950/30",
    icon: Zap,
    features: [
      "Up to 50 roster players",
      "Priority tournament entry",
      "Analytics dashboard",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    label: "Enterprise",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-950/30",
    icon: Crown,
    features: [
      "Unlimited roster players",
      "Custom tournaments",
      "Advanced analytics",
      "Dedicated support",
      "API access",
    ],
  },
};

const STATUS_INFO: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle;
}> = {
  ACTIVE: {
    label: "Active",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-950/30",
    icon: CheckCircle,
  },
  EXPIRED: {
    label: "Expired",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-950/30",
    icon: AlertTriangle,
  },
  TRIAL: {
    label: "Trial",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-950/30",
    icon: Clock,
  },
};

export function OrgSubscriptionCard({
  subscription,
  sport,
  onUpgrade,
  onRenew,
}: OrgSubscriptionCardProps) {
  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  // Default to trial/basic if no subscription
  const plan = subscription?.plan || "BASIC";
  const status = subscription?.status || "TRIAL";
  const daysRemaining = subscription?.daysRemaining || 0;
  const amount = subscription?.amount || 0;

  const planInfo = PLAN_INFO[plan] || PLAN_INFO.BASIC;
  const statusInfo = STATUS_INFO[status] || STATUS_INFO.TRIAL;
  const PlanIcon = planInfo.icon;
  const StatusIcon = statusInfo.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden">
      {/* Header with gradient */}
      <div
        className={cn(
          "p-6 text-white",
          plan === "ENTERPRISE"
            ? "bg-gradient-to-r from-amber-500 to-orange-500"
            : plan === "PRO"
            ? "bg-gradient-to-r from-purple-500 to-indigo-500"
            : "bg-gradient-to-r from-gray-600 to-gray-700"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PlanIcon className="w-6 h-6" />
              <span className="text-lg font-bold">{planInfo.label} Plan</span>
            </div>
            <Badge className={cn("text-xs", planInfo.bgColor, planInfo.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {amount > 0 ? formatCurrency(amount) : "Free"}
            </p>
            {amount > 0 && (
              <p className="text-sm opacity-80">per year</p>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Status Details */}
        <div className="space-y-3 mb-6">
          {subscription?.startDate && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-muted-foreground">Started:</span>
              <span className="font-medium text-foreground">
                {formatDate(subscription.startDate)}
              </span>
            </div>
          )}
          {subscription?.endDate && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-muted-foreground">Renewal Date:</span>
              <span className="font-medium text-foreground">
                {formatDate(subscription.endDate)}
              </span>
            </div>
          )}
          {daysRemaining > 0 && status !== "EXPIRED" && (
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-muted-foreground">Days Remaining:</span>
              <span
                className={cn(
                  "font-medium",
                  daysRemaining <= 7 ? "text-amber-600" : "text-foreground"
                )}
              >
                {daysRemaining} days
              </span>
            </div>
          )}
          {status === "TRIAL" && subscription?.trialEndsAt && (
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Trial ends {formatDate(subscription.trialEndsAt)}
                </span>
              </div>
            </div>
          )}
          {status === "EXPIRED" && (
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Your subscription has expired. Renew to continue using premium features.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Plan Features */}
        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-2">Plan Features:</p>
          <ul className="space-y-1">
            {planInfo.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {plan !== "ENTERPRISE" && status === "ACTIVE" && onUpgrade && (
            <Button
              onClick={onUpgrade}
              className={cn("flex-1 text-white gap-2", primaryBtnClass)}
            >
              <ArrowUp className="w-4 h-4" />
              Upgrade Plan
            </Button>
          )}
          {(status === "EXPIRED" || status === "TRIAL") && onRenew && (
            <Button
              onClick={onRenew}
              className={cn("flex-1 text-white gap-2", primaryBtnClass)}
            >
              <CreditCard className="w-4 h-4" />
              {status === "TRIAL" ? "Subscribe Now" : "Renew Subscription"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
