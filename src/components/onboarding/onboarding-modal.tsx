"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Trophy,
  User,
  MapPin,
  CreditCard,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  link?: string;
  optional?: boolean;
}

interface OnboardingModalProps {
  sport: "cornhole" | "darts";
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ sport, userName, isOpen, onClose }: OnboardingModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryClass = sport === "cornhole" 
    ? "bg-green-600 hover:bg-green-700" 
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    if (isOpen) {
      fetchOnboardingStatus();
    }
  }, [isOpen, sport]);

  const fetchOnboardingStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/player/profile-completeness", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const completeness = data.completeness || {};
        
        const onboardingSteps: OnboardingStep[] = [
          {
            id: "profile",
            title: "Complete Profile",
            description: "Add your name, photo, and contact details",
            icon: <User className="w-5 h-5" />,
            completed: (completeness.profileComplete as boolean) || false,
            link: `/${sport}/profile`,
          },
          {
            id: "location",
            title: "Add Location",
            description: "Set your city and state for local tournaments",
            icon: <MapPin className="w-5 h-5" />,
            completed: (completeness.hasLocation as boolean) || false,
            link: `/${sport}/profile`,
          },
          {
            id: "subscription",
            title: "Get Premium",
            description: "Unlock tournament registration and exclusive features",
            icon: <CreditCard className="w-5 h-5" />,
            completed: (completeness.hasSubscription as boolean) || false,
            link: `/${sport}/subscription`,
            optional: true,
          },
          {
            id: "first_tournament",
            title: "Join a Tournament",
            description: "Register for your first tournament",
            icon: <Trophy className="w-5 h-5" />,
            completed: (completeness.hasTournament as boolean) || false,
            link: `/${sport}/tournaments`,
          },
        ];

        setSteps(onboardingSteps);
        
        // Find first incomplete step
        const firstIncomplete = onboardingSteps.findIndex(s => !s.completed);
        setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : onboardingSteps.length - 1);
      }
    } catch (error) {
      console.error("Failed to fetch onboarding status:", error);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isComplete = completedCount === steps.length;

  const handleStepClick = (step: OnboardingStep) => {
    if (step.link && !step.completed) {
      onClose();
      router.push(step.link);
    }
  };

  const handleContinue = () => {
    const nextIncomplete = steps.findIndex((s, i) => i > currentStep && !s.completed);
    if (nextIncomplete >= 0) {
      setCurrentStep(nextIncomplete);
    } else {
      // All done
      onClose();
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              sport === "cornhole" ? "bg-green-100" : "bg-teal-100"
            )}>
              <Sparkles className={cn(
                "w-6 h-6",
                sport === "cornhole" ? "text-green-600" : "text-teal-600"
              )} />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {isComplete ? "You're All Set! 🎉" : `Welcome to VALORHIVE${userName ? `, ${userName}` : ""}!`}
              </DialogTitle>
              <DialogDescription>
                {isComplete 
                  ? "Your profile is complete. Start competing!"
                  : "Complete these steps to get started"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedCount}/{steps.length} completed</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <Card
                key={step.id}
                className={cn(
                  "cursor-pointer transition-all",
                  step.completed && "bg-muted/50",
                  !step.completed && step.link && "hover:border-primary/50 hover:bg-muted/30",
                  currentStep === index && !step.completed && "border-primary ring-1 ring-primary/20"
                )}
                onClick={() => handleStepClick(step)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                    step.completed 
                      ? "bg-green-100 text-green-600"
                      : sport === "cornhole" 
                        ? "bg-green-50 text-green-400"
                        : "bg-teal-50 text-teal-400"
                  )}>
                    {step.completed ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "font-medium",
                        step.completed && "text-muted-foreground"
                      )}>
                        {step.title}
                      </p>
                      {step.optional && !step.completed && (
                        <Badge variant="outline" className="text-xs">Optional</Badge>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm",
                      step.completed ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {step.description}
                    </p>
                  </div>
                  {!step.completed && step.link && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {isComplete ? (
            <Button 
              className={cn("w-full text-white", primaryClass)}
              onClick={onClose}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Start Competing
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
                Skip for now
              </Button>
              <Button 
                className={cn("w-full sm:w-auto text-white", primaryClass)}
                onClick={handleContinue}
              >
                Continue
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage onboarding state
export function useOnboarding(sport: "cornhole" | "darts") {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userName, setUserName] = useState<string>();

  useEffect(() => {
    // Check if user is new (first login after registration)
    const checkOnboarding = async () => {
      try {
        const response = await fetch("/api/player/me", { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setUserName(data.firstName);
          
          // Check if we should show onboarding
          // Show if: user has < 30 matches AND (no subscription OR incomplete profile)
          const matches = data.matches || 0;
          const hasSubscription = data.subscription?.status === "ACTIVE";
          const profileComplete = (data.profileCompletion || 0) >= 80;
          
          const isNewUser = matches < 30 && (!hasSubscription || !profileComplete);
          
          // Check localStorage to not show again after dismissal
          const dismissed = localStorage.getItem(`onboarding-dismissed-${sport}`);
          
          if (isNewUser && !dismissed) {
            setShowOnboarding(true);
          }
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
      }
    };

    checkOnboarding();
  }, [sport]);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(`onboarding-dismissed-${sport}`, "true");
  };

  return { showOnboarding, userName, closeOnboarding };
}
