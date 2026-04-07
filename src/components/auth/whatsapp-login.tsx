"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface WhatsAppLoginProps {
  sport: string;
  onSuccess: (data: { phone: string }) => void;
  primaryBtnClass: string;
  primaryTextClass: string;
}

export function WhatsAppLogin({
  sport,
  onSuccess,
  primaryBtnClass,
  primaryTextClass,
}: WhatsAppLoginProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Format phone to Indian format
  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");
    
    // If starts with 91, keep it
    if (digits.startsWith("91") && digits.length <= 12) {
      return `+${digits}`;
    }
    
    // If starts with 0, remove it
    if (digits.startsWith("0") && digits.length <= 11) {
      return `+91${digits.slice(1)}`;
    }
    
    // Otherwise add +91
    if (digits.length <= 10) {
      return digits.length > 0 ? `+91 ${digits}` : "";
    }
    
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  };

  // Send OTP
  const handleSendOtp = async () => {
    setLoading(true);
    setError("");

    // Validate phone
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid phone number");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, type: "whatsapp_login", sport }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send OTP");
        return;
      }

      setStep("otp");
      setCountdown(60); // 60 second countdown

      // In development, auto-fill OTP for testing
      if (data.devOtp) {
        console.log(`[DEV] OTP for testing: ${data.devOtp}`);
      }
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and Login
  const handleVerifyOtp = async () => {
    setLoading(true);
    setError("");

    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      setLoading(false);
      return;
    }

    try {
      // First verify OTP
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyData.error || "Invalid OTP");
        return;
      }

      // OTP verified, now login with phone
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phone, 
          sport: sport.toUpperCase(),
          otpLogin: true 
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        if (loginData.code === 'USER_NOT_FOUND') {
          setError("Account not found. Please register first.");
        } else {
          setError(loginData.error || "Login failed");
        }
        return;
      }

      // Success!
      onSuccess({ phone });
    } catch (err) {
      setError("Failed to verify. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    await handleSendOtp();
  };

  return (
    <div className="space-y-4">
      {step === "phone" ? (
        <>
          {/* Phone Input */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp-phone-login" className="text-gray-700">
              WhatsApp Number
            </Label>
            <div className="relative">
              <MessageCircle className="absolute left-3 top-3 h-4 w-4 text-green-500" />
              <Input
                id="whatsapp-phone-login"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="pl-10 border-gray-200 focus-visible:ring-green-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              We'll send a login code via WhatsApp
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            type="button"
            onClick={handleSendOtp}
            disabled={loading || phone.length < 13}
            className={`w-full ${primaryBtnClass} text-white gap-2 h-11`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                Login with WhatsApp
              </>
            )}
          </Button>
        </>
      ) : (
        <>
          {/* OTP Verification */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp-otp-login" className="text-gray-700">
                Verification Code
              </Label>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className={`text-sm ${primaryTextClass} hover:underline flex items-center gap-1`}
              >
                <ArrowLeft className="w-3 h-3" />
                Change number
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mb-2">
              Sent to {phone}
            </p>

            <Input
              id="whatsapp-otp-login"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(value);
              }}
              className="text-center text-2xl tracking-widest border-gray-200 focus-visible:ring-green-500 h-12"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading || otp.length !== 6}
            className={`w-full ${primaryBtnClass} text-white gap-2 h-11`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Sign In
              </>
            )}
          </Button>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-gray-400">
                Resend code in {countdown}s
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                className={`text-sm ${primaryTextClass} hover:underline flex items-center gap-1 mx-auto`}
              >
                <RefreshCw className="w-3 h-3" />
                Resend code
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
