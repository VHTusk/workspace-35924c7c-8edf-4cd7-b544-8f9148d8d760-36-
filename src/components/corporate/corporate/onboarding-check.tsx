"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Loader2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingCheckProps {
  orgId: string;
  sport: string;
  onComplete?: () => void;
}

interface OnboardingStatus {
  completed: boolean;
  currentStep: number;
  steps: Array<{
    step: number;
    title: string;
    completed: boolean;
    skipped?: boolean;
  }>;
  canSkip: boolean;
}

export function OnboardingCheck({ orgId, sport, onComplete }: OnboardingCheckProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    // Check localStorage for dismissed state
    const dismissedAt = localStorage.getItem(`onboarding-dismissed-${orgId}`);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const now = new Date();
      // Show again after 24 hours
      if (now.getTime() - dismissedDate.getTime() < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }

    fetchStatus();
  }, [orgId]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/org/${orgId}/onboarding`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);

        if (data.completed && onComplete) {
          onComplete();
        }
      }
    } catch (err) {
      console.error("Failed to fetch onboarding status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueSetup = () => {
    router.push(`/${sport}/org/onboarding`);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`onboarding-dismissed-${orgId}`, new Date().toISOString());
  };

  // Don't show anything while loading
  if (loading) {
    return null;
  }

  // Don't show if completed or dismissed
  if (!status || status.completed || dismissed) {
    return null;
  }

  // Calculate progress
  const completedSteps = status.steps.filter((s) => s.completed || s.skipped).length;
  const totalSteps = status.steps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  // Get current step title
  const currentStepTitle = status.steps.find((s) => s.step === status.currentStep)?.title || "Setup";

  return (
    <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-6">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">
                Complete Your Setup
              </h3>
              <span className={cn("text-sm font-medium", primaryTextClass)}>
                {progressPercent}% Complete
              </span>
            </div>

            <Progress value={progressPercent} className="h-2 mb-2" />

            <p className="text-sm text-gray-600 mb-3">
              You&apos;re at the <strong>{currentStepTitle}</strong> step. Complete setup to unlock all features.
            </p>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleContinueSetup}
                className={cn("text-white", primaryBtnClass)}
                size="sm"
              >
                Continue Setup
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleDismiss}
                size="sm"
                className="text-gray-500"
              >
                Remind me later
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact banner variant for sidebar or header
export function OnboardingBanner({ orgId, sport }: { orgId: string; sport: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/org/${orgId}/onboarding`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (err) {
        console.error("Failed to fetch onboarding status:", err);
      }
    };

    fetchStatus();
  }, [orgId]);

  if (!status || status.completed) {
    return null;
  }

  const completedSteps = status.steps.filter((s) => s.completed || s.skipped).length;
  const totalSteps = status.steps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer hover:bg-amber-100 transition-colors"
      onClick={() => router.push(`/${sport}/org/onboarding`)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-amber-700">Setup Progress</span>
        <span className={cn("text-xs font-medium", primaryTextClass)}>{progressPercent}%</span>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
    </div>
  );
}

// Completion celebration component
export function OnboardingCompleteBanner({ sport }: { sport: string }) {
  const [visible, setVisible] = useState(true);

  const isCornhole = sport === "cornhole";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  if (!visible) return null;

  return (
    <Alert className={cn("border-green-200", primaryBgClass)}>
      <CheckCircle className={cn("h-4 w-4", primaryTextClass)} />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-green-700">
          🎉 Setup complete! Your organization is ready to go.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVisible(false)}
          className="text-green-600 hover:text-green-700"
        >
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
}
