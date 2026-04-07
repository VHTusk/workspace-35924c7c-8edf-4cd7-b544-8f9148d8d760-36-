"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Phone, MessageCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

interface WhatsAppOTPModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (phone: string) => void;
  sport: string;
}

export function WhatsAppOTPModal({ open, onOpenChange, onSuccess, sport }: WhatsAppOTPModalProps) {
  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole 
    ? "bg-green-600 hover:bg-green-700" 
    : "bg-teal-600 hover:bg-teal-700";
  const whatsappBtnClass = "bg-[#25D366] hover:bg-[#22c55e]";

  const [step, setStep] = useState<"phone" | "otp" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Clean phone number - extract 10 digits
  const cleanPhone = (value: string) => {
    return value.replace(/\D/g, "").slice(0, 10);
  };

  // Validate Indian mobile number (starts with 6-9)
  const isValidPhone = (value: string) => {
    const cleaned = cleanPhone(value);
    return cleaned.length === 10 && /^[6-9]/.test(cleaned);
  };

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0 && step === "otp") {
      setCanResend(true);
    }
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown, step]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhone("");
      setOtp("");
      setError("");
      setCountdown(0);
      setCanResend(false);
    }
  }, [open]);

  // Send OTP
  const handleSendOTP = async () => {
    if (!isValidPhone(phone)) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone(phone) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send OTP");
        return;
      }

      // Move to OTP step
      setStep("otp");
      setCountdown(30);
      setCanResend(false);
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/whatsapp-otp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone(phone), otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid OTP");
        return;
      }

      // Success - call the onSuccess callback
      setStep("success");
      setTimeout(() => {
        onSuccess(cleanPhone(phone));
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (!canResend) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/whatsapp-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone(phone) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to resend OTP");
        return;
      }

      // Reset countdown
      setCountdown(30);
      setCanResend(false);
      setOtp("");
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Go back to phone step
  const handleBack = () => {
    setStep("phone");
    setOtp("");
    setError("");
    setCountdown(0);
    setCanResend(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            {step === "phone" && "Continue with WhatsApp"}
            {step === "otp" && "Verify OTP"}
            {step === "success" && "Verified!"}
          </DialogTitle>
          <DialogDescription>
            {step === "phone" && "Enter your WhatsApp number to receive a verification code"}
            {step === "otp" && "Enter the 6-digit code sent to your WhatsApp"}
            {step === "success" && "Your number has been verified successfully"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Phone Number */}
        {step === "phone" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500 text-sm">+91</span>
                <Phone className="absolute left-14 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-20 border-gray-200 focus-visible:ring-[#25D366]"
                  maxLength={10}
                />
              </div>
              <p className="text-xs text-gray-500">
                We&apos;ll send a verification code via WhatsApp
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              onClick={handleSendOTP}
              disabled={loading || !phone}
              className={`w-full ${whatsappBtnClass} text-white gap-2 h-11`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Send OTP via WhatsApp
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {step === "otp" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">Enter 6-digit OTP</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Sent to +91 {phone}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className={`w-full ${primaryBtnClass} text-white gap-2 h-11`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify & Continue
                </>
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center">
              {canResend ? (
                <button
                  onClick={handleResendOTP}
                  className={`text-sm ${isCornhole ? "text-green-600" : "text-teal-600"} hover:underline font-medium`}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  Resend OTP in {countdown} seconds
                </p>
              )}
            </div>

            <button
              onClick={handleBack}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Change phone number
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === "success" && (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-gray-600 text-center">
              Your phone number has been verified
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
