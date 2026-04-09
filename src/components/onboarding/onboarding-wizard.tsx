"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  User,
  MapPin,
  Target,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Calendar,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { indianStates, getDistrictsForState } from "@/lib/indian-locations";
import { toast } from "sonner";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to VALORHIVE!",
    description: "Let's get you started on your journey",
    icon: <Sparkles className="w-8 h-8" />,
  },
  {
    id: "profile",
    title: "Complete Your Profile",
    description: "Add your location to find tournaments near you",
    icon: <User className="w-8 h-8" />,
  },
  {
    id: "discover",
    title: "Discover Tournaments",
    description: "Find and join tournaments in your area",
    icon: <Trophy className="w-8 h-8" />,
  },
  {
    id: "connect",
    title: "Connect with Players",
    description: "Follow other players and build your network",
    icon: <Users className="w-8 h-8" />,
  },
  {
    id: "ready",
    title: "You're All Set!",
    description: "Your profile is ready. Let's start playing!",
    icon: <CheckCircle2 className="w-8 h-8" />,
  },
];

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  state?: string;
  district?: string;
}

export default function OnboardingWizard() {
  const router = useRouter();
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [currentStep, setCurrentStep] = useState(0);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Location state
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  const primaryTextClass = isCornhole
    ? "text-green-500 dark:text-green-400"
    : "text-teal-500 dark:text-teal-400";
  const primaryBgClass = isCornhole
    ? "bg-green-500/10 dark:bg-green-500/20"
    : "bg-teal-500/10 dark:bg-teal-500/20";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/player/me");
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          setSelectedState(data.state || "");
          setSelectedDistrict(data.district || "");
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Update available districts when state changes
  useEffect(() => {
    if (selectedState) {
      const stateObj = indianStates.find((s) => s.name === selectedState);
      if (stateObj) {
        setAvailableDistricts(getDistrictsForState(stateObj.code));
      }
    } else {
      setAvailableDistricts([]);
    }
    if (!user?.district || selectedState !== user.state) {
      setSelectedDistrict("");
    }
  }, [selectedState, user?.district, user?.state]);

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleSaveLocation = async () => {
    if (!selectedState || !selectedDistrict) {
      toast.error("Please select both state and district");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/player/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: selectedState,
          district: selectedDistrict,
        }),
      });

      if (response.ok) {
        toast.success("Location saved successfully!");
        setUser((prev) => prev ? { ...prev, state: selectedState, district: selectedDistrict } : null);
        setCurrentStep(2); // Move to discover step
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save location");
      }
    } catch (error) {
      toast.error("Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    // Mark onboarding as complete
    try {
      localStorage.setItem("onboarding_complete", "true");
      router.push(`/${sport}/dashboard`);
    } catch (error) {
      router.push(`/${sport}/dashboard`);
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleCompleteOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <Link href="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="VALORHIVE" className="h-8 w-auto" />
                <span className="text-lg font-bold text-foreground">VALORHIVE</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleCompleteOnboarding}>
                Skip for now
              </Button>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-border/50 shadow-lg">
            <CardContent className="p-8">
              {/* Step Header */}
              <div className="text-center mb-8">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                    primaryBgClass,
                    primaryTextClass
                  )}
                >
                  {steps[currentStep].icon}
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {steps[currentStep].title}
                </h2>
                <p className="text-muted-foreground">
                  {steps[currentStep].description}
                </p>
              </div>

              {/* Step Content */}
              <div className="mb-8">
                {currentStep === 0 && (
                  <div className="space-y-4">
                    <p className="text-center text-muted-foreground">
                      Welcome, <span className="font-semibold text-foreground">{user?.firstName || "Player"}</span>!
                    </p>
                    <p className="text-center text-sm text-muted-foreground">
                      VALORHIVE is your home for {isCornhole ? "Cornhole" : "Darts"} tournaments,
                      rankings, and connecting with players in your area.
                    </p>
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Trophy className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                        <p className="text-xs font-medium">Tournaments</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Target className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                        <p className="text-xs font-medium">Rankings</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                        <p className="text-xs font-medium">Community</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                Choose the state and district you want to play in.
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">State you want to play from</label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose the state you want to play from" />
                          </SelectTrigger>
                          <SelectContent>
                            {indianStates.map((state) => (
                              <SelectItem key={state.code} value={state.name}>
                                {state.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">District you want to play from</label>
                        <Select
                          value={selectedDistrict}
                          onValueChange={setSelectedDistrict}
                          disabled={!selectedState}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={selectedState ? "Choose the district you want to play from" : "Choose your playing state first"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDistricts.map((district) => (
                              <SelectItem key={district} value={district}>
                                {district}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveLocation}
                      disabled={!selectedState || !selectedDistrict || saving}
                      className={cn("w-full text-white", primaryBtnClass)}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 mr-2" />
                          Save Location
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Find tournaments that match your skill level and schedule
                    </p>
                    <div className="space-y-3">
                      <Link
                        href={`/${sport}/tournaments`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                          <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Browse Tournaments</p>
                          <p className="text-xs text-muted-foreground">Find tournaments in your area</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                      <Link
                        href={`/${sport}/leaderboard`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                          <Target className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">View Leaderboard</p>
                          <p className="text-xs text-muted-foreground">See where you rank</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                      <Link
                        href={`/${sport}/dashboard/cities`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                          <Zap className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Challenger Mode</p>
                          <p className="text-xs text-muted-foreground">Find opponents near you</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      Build your network by following other players
                    </p>
                    <div className="space-y-3">
                      <Link
                        href={`/${sport}/leaderboard`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                          <Users className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Find Players</p>
                          <p className="text-xs text-muted-foreground">Browse leaderboard and follow top players</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                      <Link
                        href={`/${sport}/profile`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", primaryBgClass)}>
                          <User className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Complete Profile</p>
                          <p className="text-xs text-muted-foreground">Add photo and bio to get more followers</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4 text-center">
                    <div className="flex justify-center gap-2 mb-4">
                      <CheckCircle2 className={cn("w-8 h-8", primaryTextClass)} />
                    </div>
                    <p className="text-muted-foreground">
                      Your profile is set up and ready to go. Start exploring tournaments,
                      connect with players, and climb the rankings!
                    </p>
                    <div className="flex flex-col gap-3 mt-6">
                      <Button
                        onClick={handleCompleteOnboarding}
                        className={cn("text-white", primaryBtnClass)}
                      >
                        Go to Dashboard
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Link href={`/${sport}/tournaments`}>
                        <Button variant="outline" className="w-full">
                          <Trophy className="w-4 h-4 mr-2" />
                          Find a Tournament
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              {currentStep < 4 && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  {currentStep !== 1 && (
                    <Button
                      onClick={handleSkip}
                      className={cn("text-white", primaryBtnClass)}
                    >
                      {currentStep === 3 ? "Complete" : "Next"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
