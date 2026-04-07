"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Mail,
  Phone,
  Trophy,
  Calendar,
  CheckCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowTournamentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  tournamentName: string;
  sport: string;
}

type Step = "subscribe" | "verify" | "success";

export function FollowTournamentModal({
  open,
  onOpenChange,
  tournamentId,
  tournamentName,
  sport,
}: FollowTournamentModalProps) {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("subscribe");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [watcherId, setWatcherId] = useState("");
  const [preferences, setPreferences] = useState({
    notifyMatchResults: true,
    notifyUpdates: true,
    notifyWinner: true,
    notifySchedule: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  const primaryClass = sport === "cornhole" 
    ? "bg-green-600 hover:bg-green-700" 
    : "bg-teal-600 hover:bg-teal-700";

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/public/tournaments/${tournamentId}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactMethod === "email" ? email : undefined,
          phone: contactMethod === "phone" ? phone : undefined,
          preferences,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.alreadySubscribed) {
          setStep("success");
          return;
        }
        setError(data.error || "Failed to subscribe");
        return;
      }

      setWatcherId(data.watcherId);
      
      // In development, show OTP
      if (data._dev_verifyToken) {
        setDevOtp(data._dev_verifyToken);
      }

      if (data.requiresVerification) {
        setStep("verify");
      } else {
        setStep("success");
      }
    } catch (err) {
      setError("Failed to subscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/public/watchers/${watcherId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Verification failed");
        return;
      }

      setStep("success");
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError("");
    
    try {
      // Re-subscribe to resend verification
      const response = await fetch(`/api/public/tournaments/${tournamentId}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contactMethod === "email" ? email : undefined,
          phone: contactMethod === "phone" ? phone : undefined,
          preferences,
        }),
      });

      const data = await response.json();
      
      if (data._dev_verifyToken) {
        setDevOtp(data._dev_verifyToken);
      }

      setError("");
      alert("Verification code resent!");
    } catch (err) {
      setError("Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep("subscribe");
    setEmail("");
    setPhone("");
    setVerifyToken("");
    setWatcherId("");
    setError("");
    setDevOtp("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetModal, 300); // Reset after animation
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "subscribe" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Follow Tournament
              </DialogTitle>
              <DialogDescription>
                Get notified about <strong>{tournamentName}</strong> updates
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Contact Method Tabs */}
              <Tabs value={contactMethod} onValueChange={(v) => setContactMethod(v as "email" | "phone")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    WhatsApp
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="mt-4">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </TabsContent>

                <TabsContent value="phone" className="mt-4">
                  <Label htmlFor="phone">WhatsApp Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll send updates via WhatsApp
                  </p>
                </TabsContent>
              </Tabs>

              {/* Notification Preferences */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notify me about:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="matchResults"
                      checked={preferences.notifyMatchResults}
                      onCheckedChange={(c) => 
                        setPreferences({ ...preferences, notifyMatchResults: !!c })
                      }
                    />
                    <label htmlFor="matchResults" className="text-sm">Match results</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="updates"
                      checked={preferences.notifyUpdates}
                      onCheckedChange={(c) => 
                        setPreferences({ ...preferences, notifyUpdates: !!c })
                      }
                    />
                    <label htmlFor="updates" className="text-sm">Tournament updates</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="winner"
                      checked={preferences.notifyWinner}
                      onCheckedChange={(c) => 
                        setPreferences({ ...preferences, notifyWinner: !!c })
                      }
                    />
                    <label htmlFor="winner" className="text-sm">Winner announcement</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="schedule"
                      checked={preferences.notifySchedule}
                      onCheckedChange={(c) => 
                        setPreferences({ ...preferences, notifySchedule: !!c })
                      }
                    />
                    <label htmlFor="schedule" className="text-sm">Schedule changes</label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <Button
                onClick={handleSubscribe}
                disabled={loading || (contactMethod === "email" ? !email : !phone)}
                className={cn("w-full", primaryClass)}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                Subscribe to Updates
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                No account needed • Unsubscribe anytime
              </p>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Verify Your Subscription
              </DialogTitle>
              <DialogDescription>
                Enter the verification code sent to your {contactMethod === "email" ? "email" : "phone"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="token">Verification Code</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  className="mt-1 text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>

              {/* Development OTP display */}
              {devOtp && (
                <div className="text-sm bg-yellow-50 text-yellow-800 p-2 rounded text-center">
                  <strong>Dev Mode:</strong> Your code is <code className="font-mono">{devOtp}</code>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <Button
                onClick={handleVerify}
                disabled={loading || !verifyToken}
                className={cn("w-full", primaryClass)}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Verify
              </Button>

              <button
                onClick={handleResend}
                disabled={loading}
                className="w-full text-sm text-primary hover:underline"
              >
                Resend code
              </button>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                You're Following!
              </DialogTitle>
              <DialogDescription>
                You'll receive updates about <strong>{tournamentName}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4 text-center">
              <div className="bg-green-50 rounded-lg p-6">
                <Trophy className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="text-sm text-green-800">
                  You'll be notified about match results, tournament updates, and the winner announcement.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleClose}
                  className={cn("w-full", primaryClass)}
                >
                  Continue Browsing
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleClose();
                    // Navigate to registration
                    window.location.href = `/${sport.toLowerCase()}/register`;
                  }}
                  className="w-full"
                >
                  Create Account to Participate
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
